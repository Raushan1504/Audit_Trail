require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const commandRoutes = require('./commands/commandRoutes');
const queryRoutes = require('./queries/queryRoutes');
const { notFoundHandler, errorHandler } = require('./middleware');
const app = express();
const port = Number(process.env.PORT) || 5000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/health', (_request, response) => {
	response.status(200).json({ status: 'ok' });
});
app.use('/api/commands', commandRoutes);
app.use('/api/queries', queryRoutes);

// Catch-all 404 handler for unmatched routes
app.use(notFoundHandler);

// Centralized error-handling middleware
app.use(errorHandler);
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
