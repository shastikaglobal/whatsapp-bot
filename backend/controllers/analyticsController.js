import pool from '../config/db.js';

export const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];
    
    if (startDate && endDate) {
      dateFilter = ' WHERE timestamp >= ? AND timestamp <= ? ';
      params.push(startDate, endDate);
    }

    const createdFilter = dateFilter.replace(/timestamp/g, 'created_at');
    const startedFilter = dateFilter.replace(/timestamp/g, 'started_at');

    // 1. Total Customers
    const { rows: customers } = await pool.query(`SELECT COUNT(*) as count FROM customers ${createdFilter}`, params);
    
    // 2. Total Conversations
    const { rows: conversations } = await pool.query(`SELECT COUNT(*) as count FROM conversations ${startedFilter}`, params);
    
    // 3. Active Conversations
    const { rows: activeConversations } = await pool.query(`SELECT COUNT(*) as count FROM conversations WHERE status = 'open'`);

    // 4. Messages Received (customer -> bot)
    const { rows: messagesReceived } = await pool.query(`SELECT COUNT(*) as count FROM messages ${dateFilter $1 dateFilter + ' AND ' : 'WHERE '} sender = 'customer'`, params);
    
    // 5. Messages Sent (ai + human)
    const { rows: messagesSent } = await pool.query(`SELECT COUNT(*) as count FROM messages ${dateFilter $1 dateFilter + ' AND ' : 'WHERE '} sender IN ('ai', 'human')`, params);

    // 6. AI Replies vs Rule Replies
    const { rows: aiRuleStats } = await pool.query(`
      SELECT 
        SUM(CASE WHEN content IN (SELECT reply_text FROM auto_reply_rules) THEN 1 ELSE 0 END) as rule_replies,
        SUM(CASE WHEN content NOT IN (SELECT reply_text FROM auto_reply_rules) THEN 1 ELSE 0 END) as ai_replies
      FROM messages 
      ${dateFilter $1 dateFilter + ' AND ' : 'WHERE '} sender = 'ai'
    `, params);

    // 7. Unread Conversations (last message was from customer)
    const { rows: unreadConversations } = await pool.query(`
      SELECT COUNT(DISTINCT m1.customer_id) as count
      FROM messages m1
      WHERE m1.sender = 'customer' 
      AND m1.timestamp = (
        SELECT MAX(timestamp) 
        FROM messages m2 
        WHERE m1.customer_id = m2.customer_id
      )
    `);

    // 8. Average Response Time
    const { rows: avgResponse } = await pool.query(`
      SELECT AVG(TIMESTAMPDIFF(SECOND, m1.timestamp, m2.timestamp)) as avg_time
      FROM messages m1
      JOIN messages m2 ON m1.customer_id = m2.customer_id
      WHERE m1.sender = 'customer' AND m2.sender IN ('ai', 'human')
      AND m2.timestamp > m1.timestamp
      AND NOT EXISTS (
        SELECT 1 FROM messages m3
        WHERE m3.customer_id = m1.customer_id
        AND m3.timestamp > m1.timestamp AND m3.timestamp < m2.timestamp
      )
    `);

    // --- CHARTS DATA ---
    const { rows: messagesChart } = await pool.query(`
      SELECT DATE(timestamp) as date, 
             SUM(CASE WHEN sender = 'customer' THEN 1 ELSE 0 END) as received,
             SUM(CASE WHEN sender IN ('ai', 'human') THEN 1 ELSE 0 END) as sent
      FROM messages
      ${dateFilter}
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `, params);

    const { rows: customersChart } = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM customers
      ${createdFilter}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, params);

    res.json({
      metrics: {
        totalCustomers: customers[0].count,
        totalConversations: conversations[0].count,
        activeConversations: activeConversations[0].count,
        unreadConversations: unreadConversations[0].count,
        messagesReceived: messagesReceived[0].count,
        messagesSent: messagesSent[0].count,
        ruleReplies: aiRuleStats[0].rule_replies || 0,
        aiReplies: aiRuleStats[0].ai_replies || 0,
        avgResponseTimeSeconds: avgResponse[0].avg_time || 0
      },
      charts: {
        messages: messagesChart,
        customers: customersChart,
        aiVsRule: [
          { name: 'AI Replies', value: Number(aiRuleStats[0].ai_replies || 0) },
          { name: 'Rule Replies', value: Number(aiRuleStats[0].rule_replies || 0) }
        ]
      }
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ error: error.message });
  }
};
