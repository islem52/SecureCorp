const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_kdc_key';

let users = [];
try {
  users = JSON.parse(fs.readFileSync('./users.json', 'utf8'));
} catch (e) {
  users = [];
}

// 0. Signup -> Create new user with attributes
app.post('/signup', (req, res) => {
  const { username, password, role, department, clearance, location } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing required fields (username, password)' });
  }

  const userExists = users.find(u => u.username === username);
  if (userExists) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  
  const newUser = {
    username,
    passwordHash: hashedPassword,
    role: role || 'Employee',
    department: department || 'general',
    clearance: clearance || 'public',
    location: location || 'internal'
  };

  users.push(newUser);
  fs.writeFileSync('./users.json', JSON.stringify(users, null, 2));
  
  console.log(`[AUTH] New user created: ${username} (${role}, Dept: ${department}, Clearance: ${clearance})`);
  res.status(201).json({ message: 'User created successfully', user: newUser });
});

// 1. Login -> Issue TGT
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  const user = users.find(u => u.username === username && u.passwordHash === hashedPassword);
  
  if (!user) {
    console.log(`[AUTH] Failed login attempt for ${username}`);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // TGT payload
  const tgtPayload = {
    type: 'TGT',
    identity: {
      username: user.username,
      role: user.role,
      department: user.department,
      clearance: user.clearance,
      location: user.location
    }
  };

  const tgt = jwt.sign(tgtPayload, JWT_SECRET, { expiresIn: '8h' });
  console.log(`[AUTH] TGT issued for ${username}`);
  
  res.json({ message: 'Login successful', tgt });
});

// 2. Request Service Ticket -> Issue ST
app.post('/request-ticket', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid TGT' });
  }

  const tgtToken = authHeader.split(' ')[1];
  const { service } = req.body;

  if (!service) {
    return res.status(400).json({ error: 'Service name required' });
  }

  try {
    const decoded = jwt.verify(tgtToken, JWT_SECRET);
    if (decoded.type !== 'TGT') {
      return res.status(401).json({ error: 'Invalid token type, expected TGT' });
    }

    // Generate session key
    const sessionKey = crypto.randomBytes(16).toString('hex');

    // Issue Service Ticket (ST)
    const stPayload = {
      type: 'ServiceTicket',
      service: service,
      identity: decoded.identity,
      sessionKey: sessionKey
    };

    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
    
    function encrypt(text) {
        let iv = crypto.randomBytes(16);
        let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    const encryptedData = encrypt(JSON.stringify(stPayload));

    const serviceTicket = jwt.sign({ encryptedData }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`[AUTH] Service Ticket issued for ${decoded.identity.username} to access ${service}`);
    
    res.json({ message: 'Service ticket requested successfully', serviceTicket });
  } catch (error) {
    console.log(`[AUTH] Invalid or expired TGT`);
    return res.status(401).json({ error: 'Invalid or expired TGT' });
  }
});

app.listen(PORT, () => {
  console.log(`[AUTH] KDC Server running on port ${PORT}`);
});
