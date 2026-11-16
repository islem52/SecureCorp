const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

let policies = { rbac: [], abac_restrictions: [] };
try {
  policies = JSON.parse(fs.readFileSync('./policies.json', 'utf8'));
} catch (e) {
  console.error("Could not load policies.json", e);
}

function resolvePath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function evaluateCondition(condition, context) {
  for (const [key, expectedValue] of Object.entries(condition)) {
    const actualValue = resolvePath(context, key);
    
    if (typeof expectedValue === 'object' && expectedValue !== null) {
      if (expectedValue['$not_equals']) {
        const compareVal = (typeof expectedValue['$not_equals'] === 'string' && expectedValue['$not_equals'].startsWith('resource.')) 
          ? resolvePath(context, expectedValue['$not_equals']) 
          : expectedValue['$not_equals'];
        if (actualValue === compareVal) return false; // Condition NOT met
      }
      else if (expectedValue['$in']) {
        if (!expectedValue['$in'].includes(actualValue)) return false; // Condition NOT met
      }
    } else {
      if (actualValue !== expectedValue) return false; // Condition NOT met
    }
  }
  return true; // All clauses met, restriction triggers
}

app.post('/evaluate', (req, res) => {
  const context = req.body;
  // Context: { user, resource, action }
  
  if (!context || !context.user || !context.resource || !context.action) {
     return res.status(400).json({ effect: 'deny', reason: 'Invalid context for evaluation' });
  }

  // 1. Check RBAC
  let rbac_allowed = false;
  let rbac_reason = `RBAC: ${context.user.role} does not have privileges for '${context.action}'`;
  
  const roleConfig = policies.rbac.find(r => r.role === context.user.role);
  if (roleConfig && roleConfig.allowed_actions.includes(context.action)) {
      rbac_allowed = true;
      rbac_reason = `RBAC: ${context.user.role} is allowed to ${context.action}`;
  }

  // 2. Check ABAC (Restrictions)
  // We assume ABAC allows by default unless a restriction is hit
  let abac_allowed = true;
  let abac_reason = "ABAC: All attribute restrictions passed";

  for (const restriction of policies.abac_restrictions) {
     const ruleTriggered = evaluateCondition(restriction.condition, context);
     if (ruleTriggered) {
         // strict Zero Trust ABAC on everyone unless handled in the policy)
         abac_allowed = false;
         abac_reason = restriction.description;
         break;
     }
  }

  // Calculate final decision
  const final_decision = (rbac_allowed && abac_allowed) ? 'GRANTED' : 'DENIED';

  // Explicitly return the theoretical checks
  return res.json({
      final_decision,
      rbac_allowed,
      rbac_reason,
      abac_allowed,
      abac_reason
  });
});

app.listen(PORT, () => {
  console.log(`[PDP] Policy Engine Server running on port ${PORT}`);
});
