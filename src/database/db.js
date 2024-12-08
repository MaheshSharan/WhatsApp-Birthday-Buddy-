const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// Ensure database directory exists
const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(config.database.path, (err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to SQLite database');
    
    // Initialize database schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    db.exec(schema, (err) => {
        if (err) {
            console.error('Error initializing database schema:', err);
            return;
        }
        console.log('Database schema initialized');
    });
});

// Database utility functions
const dbUtils = {
    // Add a new birthday
    addBirthday: (name, birthDate, phoneNumber) => {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO birthdays (name, birth_date, phone_number) VALUES (?, ?, ?)`;
            db.run(query, [name, birthDate, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.lastID);
            });
        });
    },

    // Remove a birthday by phone number
    removeBirthday: (phoneNumber) => {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM birthdays WHERE phone_number = ?`;
            db.run(query, [phoneNumber], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            });
        });
    },

    // Update birthday information
    updateBirthday: (name, birthDate, phoneNumber) => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE birthdays SET name = ?, birth_date = ? WHERE phone_number = ?`;
            db.run(query, [name, birthDate, phoneNumber], function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            });
        });
    },

    // List all birthdays
    listBirthdays: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM birthdays ORDER BY 
                strftime('%m-%d', birth_date)`;
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    },

    // Search birthday by name or phone number
    searchBirthday: (search) => {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM birthdays 
                          WHERE name LIKE ? OR phone_number LIKE ?`;
            const searchPattern = `%${search}%`;
            db.all(query, [searchPattern, searchPattern], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    },

    // Get upcoming birthdays
    getUpcomingBirthdays: (days = 1) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM birthdays 
                WHERE strftime('%m-%d', birth_date) = strftime('%m-%d', 'now', '+' || ? || ' days')
                ORDER BY name`;
            db.all(query, [days], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    },

    // Get birthday statistics
    getBirthdayStats: () => {
        return new Promise((resolve, reject) => {
            const queries = {
                total: 'SELECT COUNT(*) as count FROM birthdays',
                byMonth: `
                    SELECT 
                        strftime('%m', birth_date) as month,
                        COUNT(*) as count 
                    FROM birthdays 
                    GROUP BY month 
                    ORDER BY month
                `,
                upcoming: `
                    SELECT COUNT(*) as count 
                    FROM birthdays 
                    WHERE strftime('%m-%d', birth_date) >= strftime('%m-%d', 'now')
                    AND strftime('%m-%d', birth_date) <= strftime('%m-%d', 'now', '+7 days')
                `
            };

            const stats = {};
            let completed = 0;

            // Get total birthdays
            db.get(queries.total, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.total = row.count;
                completed++;
                if (completed === 3) resolve(stats);
            });

            // Get birthdays by month
            db.all(queries.byMonth, [], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.byMonth = rows;
                completed++;
                if (completed === 3) resolve(stats);
            });

            // Get upcoming birthdays (next 7 days)
            db.get(queries.upcoming, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.upcoming = row.count;
                completed++;
                if (completed === 3) resolve(stats);
            });
        });
    },

    // AFK related functions
    setAfk: () => {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO afk_status (is_afk, afk_since, last_updated) 
                          VALUES (1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
            db.run(query, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    },

    disableAfk: () => {
        return new Promise((resolve, reject) => {
            const query = `UPDATE afk_status SET is_afk = 0, last_updated = CURRENT_TIMESTAMP`;
            db.run(query, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(true);
            });
        });
    },

    isAfk: () => {
        return new Promise((resolve, reject) => {
            const query = `SELECT is_afk, afk_since FROM afk_status WHERE is_afk = 1`;
            db.get(query, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row || null);
            });
        });
    },

    // Bot stats functions
    getStartTime: () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT value FROM bot_stats WHERE key = ?', ['start_time'], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? parseInt(row.value) : null);
            });
        });
    },

    setStartTime: (timestamp) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT OR REPLACE INTO bot_stats (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                ['start_time', timestamp.toString()],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        });
    },

    // Close database connection
    close: () => {
        return new Promise((resolve, reject) => {
            db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
};

// Handle process termination
process.on('SIGINT', () => {
    dbUtils.close()
        .then(() => {
            console.log('Database connection closed');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Error closing database:', err);
            process.exit(1);
        });
});

module.exports = dbUtils;
