// Select DEV before dotenv loading; DB_NAME overrides are still validated, never hidden.
process.env.APP_ENV = 'dev';
await import('../src/server.js').then(({ app }) => {
  app.listen(process.env.PORT || 3000, '127.0.0.1', () => console.log('CareerOps DEV listening locally'));
});
