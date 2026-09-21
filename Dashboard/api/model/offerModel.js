const pool = require('../../../src/models/database');

const getAllOffers = async () => {
    const sql = `SELECT * FROM job_offers;`
    const [result] = await pool.query(sql);
    return result;
}

module.exports = {
    getAllOffers
}