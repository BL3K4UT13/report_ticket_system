const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 5179;

app.use(cors({
    origin: '*', //'http://localhost:3000',
    credentials: true,
}));

const pool = new Pool({
    user: 'postgres', 
    host: 'localhost',
    database: 'postgres', 
    password: 'Blekaut13!', 
    port: 5000,
});

app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        console.log(err);
        res.status(500).json({ error: 'Erro ao buscar tickets' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});