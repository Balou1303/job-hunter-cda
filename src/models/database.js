const mysql = require('mysql2/promise');
const logger = require('../logger');

require('dotenv').config();


const Database = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
})

Database.getConnection()
try {
    logger.info("database ok ✅​");
    
} catch (error) {
    logger.error("database ko ❌​");
    
}

module.exports = Database; // export d'une instance unique (Singleton)
