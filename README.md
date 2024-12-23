# Simple Home Trading System
This repository contains a simple home trading system using Node.js.

## Features

- User Authentication (Login, Logout, Signup, and Account Deletion)

- Stock Information Viewing

- Stock Trading (Buy/Sell Orders)

- Viewing Personal Account Information


## ER Diagram
![ER_Diagram](https://github.com/user-attachments/assets/90cbec2f-a803-4c72-826e-853935df69c3)


## Relational Schema
![relation_schema](https://github.com/user-attachments/assets/fde15009-da59-428d-80c1-9402629f9785)



## API Endpoints

**1. Home Page (/)**

- Renders the main page with buttons to navigate to other pages.

**2. Login (/login)**

- Displays a login page where users can input their username and password.

**3. Logout (/logout)**

- Logs out the user and redirects them to the home page. This endpoint does not have a separate page but handles logout requests.

**4. Signup (/signup)**

- Renders a signup page with input fields for required information. Submitting the form via a POST request processes the user registration.

**5. Account Deletion (/userdelete)**

- Displays a page for account deletion. Users need to confirm their password before proceeding. A POST request with the password processes the account deletion and redirects the user to the home page.

**6. My Information (/myinfo)**

- Displays user account information such as available funds. Includes input fields for deposit/withdrawal and buttons to view stock holdings and transaction history.

**7. Stock Information (/stock)**

- Shows a list of all available stocks for trading.

- _Top Rising Stocks (/stock/top-rising)_: Displays a ranking of stocks based on their growth over the past week.

- _Stock Details (/stock/{stock_code})_: Displays detailed information about a specific stock.

**8. Stock Trading (/trading)**

- Provides a page for placing buy/sell orders for stocks.

- _Buy Order (/trading/buy-order/{stock_code})_: Executes a buy order for the specified stock.
