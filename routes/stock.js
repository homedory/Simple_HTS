const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);

router.get("/", (req, res) => {
    const searchKeyword = req.query.search;

    let stockListQuery = `SELECT * FROM stock`;
    const queryParams = [];

    if (searchKeyword) {
        stockListQuery += ` WHERE name LIKE ?`;
        queryParams.push(`%${searchKeyword}%`);
    }

    query(stockListQuery, queryParams, (error, results) => {
        if (error) {
            console.error("DB error:", error);
            res.status(500).send("Server error");
        }

        const stockList = results.map(stock => {
            const rateOfChange = ((stock.current_price - stock.closing_price) / stock.closing_price * 100).toFixed(2);

            return {
                name: stock.name,
                stock_code: stock.stock_code,
                current_price: stock.current_price,
                rate_of_change: rateOfChange
            }
        });

        res.render("allStocksPage", { stockList, searchKeyword });
    });  
});

router.get("/details/:stock_code", async (req, res) => {
    const stockCode = req.params.stock_code;

    try {
        // Get stock information
        const stockInfo = (await query(`SELECT * FROM stock WHERE stock_code = ? LIMIT 1`, [stockCode]))[0];

        const rateOfChange = ((stockInfo.current_price - stockInfo.closing_price) / stockInfo.closing_price * 100).toFixed(2);
        stockInfo["rate_of_change"] = rateOfChange;

        // Get transaction list
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const transactions = await query(`
            SELECT transaction.price AS price, transaction.quantity AS quantity, transaction.time AS time 
            FROM transaction INNER JOIN \`order\` USING (order_id) 
            WHERE transaction.stock_code = ? AND order_type = 'BUY' AND transaction.time >= ?
            ORDER BY transaction.time DESC`, 
            [stockCode, oneWeekAgo]
        );

        const transactionList = transactions.map((transaction => {
            const transactionDate = new Date(transaction.time);
            const date = transactionDate.toISOString().split('T')[0]; 
            const time = transactionDate.toTimeString().split(' ')[0];

            return {
                price: transaction.price,
                quantity: transaction.quantity,
                date: date,
                time: time
            };
        }));

        res.render("stockInfoPage", { stockInfo, transactionList });
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});

router.get("/order_book/:stock_code", async (req, res) => {
    const stockCode = req.params.stock_code;

    try {
        // Get stock information
        const stockInfo = (await query(`SELECT * FROM stock WHERE stock_code = ? LIMIT 1`, [stockCode]))[0];

        const rateOfChange = ((stockInfo.current_price - stockInfo.closing_price) / stockInfo.closing_price * 100).toFixed(2);
        stockInfo["rate_of_change"] = rateOfChange;

        // Get order Lists
        const sellOrderList = await query(`
            SELECT SUM(quantity) AS total_quantity, price
            FROM \`order\` 
            WHERE stock_code = ? AND status = 'UNEXECUTED' AND order_type = 'SELL' AND price_type = 'LIMIT'
            GROUP BY price
            ORDER BY price ASC
            LIMIT 5`,
            [stockCode]
        );

        const buyOrderList = await query(`
            SELECT SUM(quantity) AS total_quantity, price
            FROM \`order\` 
            WHERE stock_code = ? AND status = 'UNEXECUTED' AND order_type = 'BUY' AND price_type = 'LIMIT'
            GROUP BY price
            ORDER BY price DESC
            LIMIT 5`,
            [stockCode]
        );

        const sellTotalQuantity = (await query(`
            SELECT SUM(quantity) AS total_quantity
            FROM \`order\` 
            WHERE stock_code = ? AND status = 'UNEXECUTED' AND order_type = 'SELL' AND price_type = 'LIMIT'`,
            [stockCode]
        ))[0]?.total_quantity || 0;

        const buyTotalQuantity = (await query(`
            SELECT SUM(quantity) AS total_quantity
            FROM \`order\` 
            WHERE stock_code = ? AND status = 'UNEXECUTED' AND order_type = 'BUY' AND price_type = 'LIMIT'`,
            [stockCode]
        ))[0]?.total_quantity || 0;

        res.render("stockOrderBookPage", { stockInfo, sellOrderList, buyOrderList, sellTotalQuantity, buyTotalQuantity });
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});


router.get("/top-rising", (req, res) => {

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let stockListQuery = `
        SELECT stock_code, name, stock.current_price AS current_price,
            (stock.current_price - stock_info.closing_price) / stock_info.closing_price * 100 AS rate_of_change
        FROM stock INNER JOIN stock_info USING (stock_code)
        WHERE date = ?
        ORDER BY rate_of_change DESC;        
    `;

    query(stockListQuery, [oneWeekAgo], (error, results) => {
        if (error) {
            console.error("DB error:", error);
            res.status(500).send("Server error");
        }

        const stockList = results.map(stock => {

            return {
                name: stock.name,
                stock_code: stock.stock_code,
                current_price: stock.current_price,
                rate_of_change: Number(stock.rate_of_change).toFixed(2)
            }
        });

        res.render("topRisingStocksPage", { stockList });
    });  
});


module.exports = router;