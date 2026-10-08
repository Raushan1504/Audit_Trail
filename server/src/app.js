require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const commandRoutes = require('./commands/commandRoutes');
const queryRoutes = require('./queries/queryRoutes');
const auditRoutes = require('./audit/auditRoutes');
const {
	notFoundHandler,
	errorHandler,
	immutabilityGuard,
	createRateLimiter,
	cacheControlMiddleware,
	securityHeadersMiddleware
} = require('./middleware');
const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(securityHeadersMiddleware);
app.use(cacheControlMiddleware);
app.use(createRateLimiter({ maxRequests: 200 }));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/health', (_request, response) => {
	response.status(200).json({ status: 'ok' });
});

app.use(['/api/events', '/api/commands', '/api/queries', '/api/audit'], immutabilityGuard);

app.use('/api/commands', commandRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/audit', auditRoutes);

app.use(notFoundHandler);

app.use(errorHandler);
if (require.main === module) {
	connectDB()
		.then(() => {
			console.log(`✓ MongoDB connection established.`);
			if (process.env.DISABLE_PROJECTION_WORKER !== 'true') {
				const { startProjectionWorker } = require('./projections/projectionWorker');
				const worker = startProjectionWorker();
				let lastLoggedError = '';
				let lastErrorTime = 0;
				worker.on('error', (err) => {
					const msg = err?.message || String(err);
					const now = Date.now();
					if (msg !== lastLoggedError || now - lastErrorTime > 10000) {
						lastLoggedError = msg;
						lastErrorTime = now;
						console.error('[ProjectionWorker] Background projection error:', msg);
					}
				});
			}
		})
		.catch((error) => {
			console.warn(`⚠️ MongoDB connection unavailable (${error.message}).`);
			console.warn(`💡 Server is running in resilient mode on port ${port}. (Tip: Add MONGODB_URI in server/.env or start local mongod for persistence)`);
		})
		.finally(() => {
			app.listen(port, () => {
				console.log(`🚀 Audit Trail API server listening on http://localhost:${port}`);
			});
		});
}

module.exports = app;
