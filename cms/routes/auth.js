const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.findUserByEmail(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at });
});

router.post('/register', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create users' });
  }

  const { name, email, password, role = 'editor' } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  if (db.findUserByEmail(email.trim())) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const user = db.createUser({
    id,
    name: name.trim(),
    email: email.trim(),
    password_hash: hash,
    role: role === 'admin' ? 'admin' : 'editor',
  });

  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.get('/users', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const users = db.getUsers().map(({ password_hash, ...u }) => u).sort((a, b) => b.created_at.localeCompare(a.created_at));
  res.json(users);
});

module.exports = router;
