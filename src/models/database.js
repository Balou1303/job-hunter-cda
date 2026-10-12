const mysql = require('mysql2/promise');
const logger = require('../logger');

require('dotenv').config();


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
})

pool.getConnection()
try {
    logger.info("database ok ✅​");
    
} catch (error) {
    logger.error("database ko ❌​");
    
}

module.exports = pool; // export d'une instance unique (Singleton)
