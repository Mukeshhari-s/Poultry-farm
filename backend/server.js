require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI);

app.get('/', (req,res) => res.send('Poultry backend running'));
app.get('/api/health', (req,res) => res.json({ ok: true, time: new Date() }));

// Register routes BEFORE listening
app.use('/api/flocks', require('./routes/flocks'));

const feedRoute = require('./routes/feed');
app.use('/api/feed', feedRoute);

// Now start the server
app.listen(PORT, () => console.log(`Server started on ${PORT}`));
app.use("/api/medicine", require("./routes/medicine"));

app.use('/api/daily', require('./routes/dailyMonitoring'));

app.use('/api/sales', require('./routes/sales'));

const finalReport = require('./reports/final_farm_closing_report');
app.use(finalReport);
