const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config({ path: '../../.env' });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use('/api/offers', require('./routes/offerRoutes'));

app.listen(process.env.SERVER_PORT, () => {
    console.log(`L'API est en cours d'exécution sur le port ${process.env.SERVER_PORT}`);
});