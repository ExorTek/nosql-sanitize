/**
 * !!!! IMPORTANT: Just only for Express.js!
 * Express body/query are sanitized by the middleware.
 * For route params (:id, :slug), use paramSanitizeHandler.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const { paramSanitizeHandler } = mongoSanitize;

const app = express();
app.use(express.json());
app.use(mongoSanitize());

// Register param handler for specific params
app.param('userId', paramSanitizeHandler());
app.param('postId', paramSanitizeHandler({ replaceWith: '_' }));

app.get('/user/:userId', (req, res) => {
  // GET /user/$admin → req.params.userId === "admin"
  res.json({ userId: req.params.userId });
});

app.get('/post/:postId/comments', (req, res) => {
  // GET /post/$inject/comments → req.params.postId === "_inject"
  res.json({ postId: req.params.postId });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Test: curl http://localhost:3000/user/$admin');
  console.log('Test: curl http://localhost:3000/post/$inject/comments');
});
