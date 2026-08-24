require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');

// --- CQRS Route Imports ---
const commandRoutes = require('./commands/commandRoutes');
const queryRoutes = require('./queries/queryRoutes');

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health Check ---
app.get('/health', (_request, response) => {
	response.status(200).json({ status: 'ok' });
});

// --- CQRS Route Boundaries ---
app.use('/api/commands', commandRoutes);
app.use('/api/queries', queryRoutes);

// --- Global Error Handler (must be registered after routes) ---
app.use((error, _request, response, _next) => {
	console.error(error);
	response.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
	connectDB()
		.then(() => {
			app.listen(port, () => {
				console.log(`Audit Trail server listening on port ${port}`);
			});
		})
		.catch((error) => {
			console.error('Failed to start the server due to MongoDB connection failure:', error);
			process.exit(1);
		});
}

module.exports = app;
