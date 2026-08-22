require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_request, response) => {
	response.status(200).json({ status: 'ok' });
});

app.use((error, _request, response, _next) => {
	console.error(error);
	response.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
	app.listen(port, () => {
		console.log(`Audit Trail server listening on port ${port}`);
	});
}

module.exports = app;
