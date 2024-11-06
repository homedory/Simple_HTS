const sql_connection = require("./db");
const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);


async function createTransactions(sellOrderId, buyOrderId, stockCode, price, quantity) {
    const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    query(`
        INSERT INTO transaction(order_id, stock_code, time, price, quantity)
        VALUES(?, ?, ?, ?, ?) `,
        [sellOrderId, stockCode, currentDateTime, price, quantity]
    );

    query(`
        INSERT INTO transaction(order_id, stock_code, time, price, quantity)
        VALUES(?, ?, ?, ?, ?) `,
        [buyOrderId, stockCode, currentDateTime, price, quantity]
    );
}

async function completOrder(orderId) {  
    await query(`
        UPDATE \`order\`
        SET quantity = 0, status = 'EXECUTED'
        WHERE order_id = ?`,
        [orderId]
    );
}

async function updateOrderQuantity(orderId, quantity) {
    await query(`
        UPDATE \`order\`
        SET quantity = ?
        WHERE order_id = ?`,
        [quantity, orderId]
    );
}

async function updateBuyerHasStock(accountId, stockCode, totalAmount, quantity) {

    if (totalAmount == 0 || quantity == 0)
        return;

    const hasStock = (await query(
        `SELECT * FROM has_stock WHERE account_id = ? AND stock_code = ?`,
        [accountId, stockCode]
    ))[0];

    if (!hasStock) {
        await query(
            `INSERT INTO has_stock (account_id, stock_code, avg_price, num_of_shares) VALUES (?, ?, ?, ?)`,
            [accountId, stockCode, (Number(totalAmount) / Number(quantity)).toFixed(0), quantity]
        );
    }
    else {
        
        let totalPrice = Number(hasStock.avg_price) * Number(hasStock.num_of_shares);
        totalPrice += Number(totalAmount);
        const totalNumOfShares = Number(hasStock.num_of_shares) + Number(quantity);
        const avgPrice = Math.round(totalPrice / totalNumOfShares);

        await query(`
            UPDATE has_stock 
            SET avg_price = ?, num_of_shares = ? 
            WHERE account_id = ? AND stock_code = ?`,
            [avgPrice, totalNumOfShares, accountId, stockCode]
        );
    }
}

async function updateSellerHasStock(accountId, stockCode, quantity) {

    if (quantity == 0)
        return;

    await query(`
        UPDATE has_stock 
        SET num_of_shares = num_of_shares - ? 
        WHERE account_id = ? AND stock_code = ?`,
        [quantity, accountId, stockCode]
    );
}

async function executeBuyOrder(orderId) {
    const order = (await query(`SELECT * FROM \`order\` WHERE order_id = ?`, [orderId]))[0];

    let sellOrderListQuery = `
        SELECT *
        FROM \`order\` 
        WHERE stock_code = ? AND order_type = ? AND status = ? AND price_type = 'LIMIT'
    `;
    const queryParams = [order.stock_code, 'SELL', 'UNEXECUTED'];

    if (order.price_type === 'LIMIT') {
        sellOrderListQuery += ' AND price <= ?';
        queryParams.push(order.price);
    }
    sellOrderListQuery += ' ORDER BY price ASC, time ASC';

    // Retrieve the list of sell orders that can be executed
    const sellOrderList = await query(sellOrderListQuery, queryParams);

    let currentPrice = null;
    let remainQuantity = Number(order.quantity);
    let totalTransactionAmount = 0;

    for (const sellOrder of sellOrderList) {
        if (remainQuantity <= 0) {
            break;
        }

        let transactionQuantity;
        if (sellOrder.quantity <= remainQuantity) {
            await completOrder(sellOrder.order_id);

            transactionQuantity = sellOrder.quantity;
            remainQuantity -= Number(sellOrder.quantity);
        }
        else {
            await updateOrderQuantity(sellOrder.order_id, Number(sellOrder.quantity) - Number(remainQuantity));

            transactionQuantity = remainQuantity;
            remainQuantity = 0;
        }

        // Create transaction data in database
        const transactionAmount = Number(sellOrder.price) * Number(transactionQuantity);
        currentPrice = sellOrder.price;
        await createTransactions(sellOrder.order_id, orderId, order.stock_code, sellOrder.price, transactionQuantity);

        // Update seller's account balance
        await query(`UPDATE account SET account_balance = account_balance + ? WHERE account_id = ?`, 
            [transactionAmount, sellOrder.account_id]
        );

        // Update seller's has_stock info
        await updateSellerHasStock(sellOrder.account_id, order.stock_code, transactionQuantity);


        totalTransactionAmount += transactionAmount;
    }

    // Update change in current order
    if (remainQuantity == 0) {
        completOrder(order.order_id);
    }
    else if (order.price_type === 'MARKET') {
        query(`
            UPDATE \`order\`
            SET quantity = ?, status = 'EXECUTED'
            WHERE order_id = ?`,
            [remainQuantity, order.order_id]
        );
    }
    else if (order.price_type === 'LIMIT') {
        if (remainQuantity == 0) {
            query(`
                UPDATE \`order\`
                SET quantity = ?, status = 'EXECUTED'
                WHERE order_id = ?`,
                [remainQuantity, order.order_id]
            );    
        }
        else {
            query(`
                UPDATE \`order\`
                SET quantity = ?
                WHERE order_id = ?`,
                [remainQuantity, order.order_id]
            );
        }
    }
    
    // Update buyer(current orderer)'s account balance
    if (order.price_type === 'LIMIT') {
        const redundantAmount = Number(order.price) * (Number(order.quantity) - remainQuantity) - totalTransactionAmount;
        await query(`
            UPDATE account SET account_balance = account_balance + ? WHERE account_id = ?`,
            [redundantAmount, order.account_id]
        );
    }
    else if (order.price_type === 'MARKET') {
        await query(`
            UPDATE account SET account_balance = account_balance - ? WHERE account_id = ?`,
            [totalTransactionAmount, order.account_id]
        );
    }

    
    // Update buyer(current orderer)'s has_stock info
    await updateBuyerHasStock(order.account_id, order.stock_code, totalTransactionAmount, Number(order.quantity) - remainQuantity);
    

    // Update current price of stock
    if (currentPrice !== null) {
        await query(`UPDATE stock SET current_price = ? WHERE stock_code = ?`, [currentPrice, order.stock_code]);
    }
}


async function executeSellOrder(orderId) {
    const order = (await query(`SELECT * FROM \`order\` WHERE order_id = ?`, [orderId]))[0];

    let buyOrderListQuery = `
        SELECT *
        FROM \`order\` 
        WHERE stock_code = ? AND order_type = ? AND status = ? AND price_type = 'LIMIT'
    `;
    const queryParams = [order.stock_code, 'BUY', 'UNEXECUTED'];

    if (order.price_type === 'LIMIT') {
        buyOrderListQuery += ' AND price >= ?';
        queryParams.push(order.price);
    }
    buyOrderListQuery += ' ORDER BY price DESC, time ASC';

    // Retrieve the list of buy orders that can be executed
    const buyOrderList = await query(buyOrderListQuery, queryParams);

    let currentPrice = null;
    let remainQuantity = Number(order.quantity);
    let totalTransactionAmount = 0;

    for (const buyOrder of buyOrderList) {
        if (remainQuantity <= 0) {
            break;
        }

        let transactionQuantity;
        if (buyOrder.quantity <= remainQuantity) {
            await completOrder(buyOrder.order_id);

            transactionQuantity = buyOrder.quantity;
            remainQuantity -= Number(buyOrder.quantity);
        }
        else {
            await updateOrderQuantity(buyOrder.order_id, Number(buyOrder.quantity) - Number(remainQuantity));

            transactionQuantity = remainQuantity;
            remainQuantity = 0;
        }

        const transactionAmount = Number(buyOrder.price) * Number(transactionQuantity);
        currentPrice = buyOrder.price;
        
        // Create transaction data in database
        await createTransactions(buyOrder.order_id, orderId, order.stock_code, buyOrder.price, transactionQuantity);

        // Update buyer's has_stock info
        await updateBuyerHasStock(buyOrder.account_id, order.stock_code, transactionAmount, transactionQuantity);

        totalTransactionAmount += transactionAmount;
    }

    // Update change in current order
    if (remainQuantity == 0) {
        completOrder(order.order_id);
    }
    else if (order.price_type === 'MARKET') {
        query(`
            UPDATE \`order\`
            SET quantity = ?, status = 'EXECUTED'
            WHERE order_id = ?`,
            [remainQuantity, order.order_id]
        );
    }
    else if (order.price_type === 'LIMIT') {
        if (remainQuantity == 0) {
            query(`
                UPDATE \`order\`
                SET quantity = ?, status = 'EXECUTED'
                WHERE order_id = ?`,
                [remainQuantity, order.order_id]
            );    
        }
        else {
            query(`
                UPDATE \`order\`
                SET quantity = ?
                WHERE order_id = ?`,
                [remainQuantity, order.order_id]
            );
        }
    }
    
    // Update seller's account balance
    await query(`
        UPDATE account SET account_balance = account_balance + ? WHERE account_id = ?`,
        [totalTransactionAmount, order.account_id]
    );

    // Update seller's has_stock info
    await updateSellerHasStock(order.account_id, order.stock_code, Number(order.quantity) - Number(remainQuantity));

    // Update current price of stock
    if (currentPrice !== null) {
        await query(`UPDATE stock SET current_price = ? WHERE stock_code = ?`, [currentPrice, order.stock_code]);
    }
}


module.exports = executeBuyOrder, executeSellOrder;

module.exports = {
    executeBuyOrder: executeBuyOrder,
    executeSellOrder: executeSellOrder
};

