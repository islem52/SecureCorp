const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_kdc_key';
const PDP_URL = process.env.PDP_URL || 'http://localhost:3001/evaluate';
const SERVICE_NAME = process.env.SERVICE_NAME || 'finance';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';

function decrypt(text) {
    let textParts = text.split(':');
    let iv = Buffer.from(textParts.shift(), 'hex');
    let encryptedText = Buffer.from(textParts.join(':'), 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

let resources = [];
try {
  resources = JSON.parse(fs.readFileSync('./resources.json', 'utf8'));
} catch (e) {
  console.error('[FINANCE-SERVICE] Could not load resources.json', e);
}

async function checkAccess(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Service Ticket' });
  }

  const token = authHeader.split(' ')[1];
  try {
    let decodedToken;
    try {
      const decodedJWT = jwt.verify(token, JWT_SECRET);
      if (!decodedJWT.encryptedData) throw new Error('Missing encrypted payload');
      const decryptedString = decrypt(decodedJWT.encryptedData);
      decodedToken = JSON.parse(decryptedString);
    } catch (e) {
      return res.status(403).json({ error: 'Failed to decrypt or verify token payload' });
    }

    if (decodedToken.type !== 'ServiceTicket' || decodedToken.service !== SERVICE_NAME) {
      return res.status(403).json({ error: 'Invalid token type or wrong destination service' });
    }

    req.user = decodedToken.identity;
    
    // Find requested resource ID if present via param or body
    const resourceId = req.params.id || (req.body && req.body.id);
    let requestedResource = resources.find(r => r.id === resourceId);

    // If resource not found and it's a GET, we might want to let them see a default public resource or fail
    if (!requestedResource) {
      if (req.method === 'POST') {
        requestedResource = { department: SERVICE_NAME, classification: req.body.classification || 'confidential' };
      } else {
        return res.status(404).json({ error: 'Resource not found' });
      }
    }

    let action = 'read';
    if (req.method === 'POST') action = 'write';
    if (req.method === 'DELETE') action = 'delete';

    // Call PDP
    console.log(`[FINANCE-SERVICE] Asking PDP to evaluate ${action} on ${requestedResource.classification} resource for ${req.user.username}`);
    const pdpRes = await axios.post(PDP_URL, {
      user: req.user,
      resource: { department: requestedResource.department, classification: requestedResource.classification },
      action: action
    });

    const decision = pdpRes.data;
    console.log(`\n[${req.user.username} -> ${requestedResource.name} (${action})] -> Decision: ${decision.final_decision}`);
    console.log(`  - RBAC Evaluation: ${decision.rbac_allowed ? 'Pass' : 'Fail'} (Reason: ${decision.rbac_reason})`);
    console.log(`  - ABAC Evaluation: ${decision.abac_allowed ? 'Pass' : 'Fail'} (Reason: ${decision.abac_reason})\n`);

    if (decision.final_decision === 'GRANTED') {
      req.requestedResource = requestedResource;
      next();
    } else {
      res.status(403).json({ 
        error: 'Access Denied by Policy Engine', 
        rbac: decision.rbac_reason,
        abac: decision.abac_reason 
      });
    }
  } catch (error) {
     console.error(`[FINANCE-SERVICE] Authorization error:`, error.message);
     return res.status(401).json({ error: 'Invalid or expired Ticket' });
  }
}

app.get('/resource/:id', checkAccess, (req, res) => {
  res.json({ message: 'Resource accessed successfully', data: req.requestedResource.data });
});

app.post('/resource', checkAccess, (req, res) => {
  res.json({ message: 'Resource created successfully (Simulated)' });
});

app.delete('/resource/:id', checkAccess, (req, res) => {
  res.json({ message: 'Resource deleted successfully (Simulated)' });
});

app.listen(PORT, () => {
  console.log(`[FINANCE-SERVICE] Running on port ${PORT}`);
});
