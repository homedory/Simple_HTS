const express = require("express");
const router = express.Router();
const sql_connection = require("../db");

const util = require('util');
const query = util.promisify(sql_connection.query).bind(sql_connection);


router.get("/", (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }
    let balance = 0;
    let message = req.session.message || null;
    let requestResponse = req.session.requestResponse || null;

    req.session.message = null;
    req.session.requestResponse = null;

    sql_connection.query(
        'SELECT account_balance FROM account INNER JOIN user USING (user_id) WHERE user_id = ?',
         [req.session.userID], 
         (error, results) => {
            if (error) throw error;
                
            if (results.length == 1) {
                balance = results[0].account_balance;
            }
            res.render("myInfoPage", { balance, message, requestResponse });
    })    
});

router.post("/withdrawal", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const {amount} = req.body;

    try {
        const results = await query('SELECT account_balance FROM account WHERE user_id = ?', [req.session.userID]);
        
        let balance = 0;
        if (results.length === 1) {
            balance = results[0].account_balance;
        }

        // Check withdrawal amount
        if (amount > balance) {
            req.session.message = "잔고 부족";
            req.session.requestResponse = 'fail';
            return res.render("myinfoPage", { requestResponse: 'fail', message: "잔고 부족", balance: balance });
        }

        // Update balance
        const newBalance = balance - amount;
        query('UPDATE account SET account_balance = ? WHERE user_id = ?', [newBalance, req.session.userID]);

        req.session.message = "인출 성공";
        req.session.withdrawalResult = 'success';
        res.redirect('/myinfo')
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});


router.post("/deposit", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const {amount} = req.body;

    try {
        const results = await query('SELECT account_balance FROM account WHERE user_id = ?', [req.session.userID]);
        
        let balance = 0;
        if (results.length === 1) {
            balance = results[0].account_balance;
        }

        await query('UPDATE account SET account_balance = account_balance + ? WHERE user_id = ?', [amount, req.session.userID]);

        req.session.message = "Deposit successful";
        req.session.withdrawalResult = 'success';
        res.redirect('/myinfo')
    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});



router.get("/mystock", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const search_keyword = req.query.search;

    try {
        const account = await query('SELECT * FROM account WHERE user_id = ? LIMIT 1', [req.session.userID]);
        const accountId = account[0].account_id;

        let stockListQuery = 'SELECT * FROM has_stock INNER JOIN stock USING (stock_code) WHERE account_id = ? AND num_of_shares > 0';
        const queryParams = [accountId];

        if (search_keyword) {
            stockListQuery += ' AND name LIKE ?';
            queryParams.push(`%${search_keyword}%`);
        }

        const stockList = await query(stockListQuery, queryParams);
        const orderList = await query(`
            SELECT stock_code, SUM(quantity) AS ordered_quantity 
            FROM \`order\` WHERE account_id = ? AND order_type = ? AND status = ? 
            GROUP BY stock_code`,
            [accountId, "SELL", "UNEXECUTED"]
        );


        const stocks = stockList.map(stock => {
            const profit = (stock.current_price - stock.avg_price) * stock.num_of_shares;
            const profitRate = ((stock.current_price - stock.avg_price) / stock.avg_price * 100).toFixed(2);
            const tradableQuantity = stock.num_of_shares - ((orderList.find(q => q.stock_code === stock.stock_code) || {}).ordered_quantity || 0);
            
            return {
                name: stock.name,
                avg_buying_price: stock.avg_price,
                current_price: stock.current_price,
                num_of_stocks: stock.num_of_shares,
                num_tradable: tradableQuantity,
                profit: profit,
                profit_rate: profitRate
            };
        });

        res.render("myStockPage", { stocks, search_keyword });

    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});


router.get("/history", async (req, res) => {
    if (!req.session.userID) {
        return res.redirect("/login");
    }

    const search_keyword = req.query.search;
    const start_date = req.query.start_date;
    const end_date = req.query.end_date;

    try {
        const account = await query('SELECT * FROM account WHERE user_id = ? LIMIT 1', [req.session.userID]);
        const accountId = account[0].account_id;

        let transactionListQuery = `
            SELECT stock.name AS stock_name, order.order_type AS order_type, transaction.price AS price, transaction.quantity AS quantity, transaction.time AS time
            FROM transaction 
            INNER JOIN stock USING (stock_code) 
            INNER JOIN \`order\` USING (order_id) 
            WHERE account_id = ?
        `;

        const queryParams = [accountId];

        if (search_keyword) {
            transactionListQuery += ' AND name LIKE ?';
            queryParams.push(`%${search_keyword}%`);
            console.log(search_keyword);
        }

        if (start_date) {
            transactionListQuery += ' AND DATE(transaction.time) >= ?';
            queryParams.push(start_date);
        }

        if (end_date) {
            transactionListQuery += ' AND DATE(transaction.time) <= ?';
            queryParams.push(end_date);
        }

        transactionListQuery += ` ORDER BY transaction.time DESC`;

        const transactionList = await query(transactionListQuery, queryParams);


        const transactionHistory = transactionList.map(transaction => {           
            const transactionDate = new Date(transaction.time);
            const date = transactionDate.toISOString().split('T')[0]; 
            const time = transactionDate.toTimeString().split(' ')[0];

            return {
                stock_name: transaction.stock_name,
                type: transaction.order_type,
                price: transaction.price,
                quantity: transaction.quantity,
                date: date,
                time: time
            };
        });

        res.render("myHistoryPage", { transactionHistory, search_keyword, start_date, end_date });

    } catch (error) {
        console.error("DB error:", error);
        res.status(500).send("Server error");
    }
});


module.exports = router;