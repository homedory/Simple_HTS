const express = require('express');
const app = express();

const router = express.Router();
const session = require('express-session');

app.use(session({
    secret: 'simple_hts', 
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 30*60*1000
    }
}));

app.use(express.json());
app.use(express.urlencoded({extended : true}));

app.set("view engine", "ejs");
app.set("views", "./views");

app.get("/", (req, res) => {
    const isLoggedIn = req.session.userID ? true : false;;
    res.render("app", { isLoggedIn });
});

const loginRoute = require("./routes/login");
app.use("/login", loginRoute);

const logoutRoute = require("./routes/logout");
app.use("/logout", logoutRoute);

const signupRoute = require("./routes/signup");
app.use("/signup", signupRoute);

const userdeleteRoute = require("./routes/userdelete");
app.use("/userdelete", userdeleteRoute);

const myinfoRoute = require("./routes/myinfo");
app.use("/myinfo", myinfoRoute);

const stockRoute = require("./routes/stock");
app.use("/stock", stockRoute);

const tradingRoute = require("./routes/trading");
app.use("/trading", tradingRoute);


app.listen(3000, () => {
    console.log("server running");
});
