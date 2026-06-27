/**
 * Database Setup & Seeding Script (Node.js version of setup.php)
 * Reads the supabase_schema.sql file and executes it, then seeds the database.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
    console.log("Neural Link Established. System Initialization Starting...");

    try {
        // 1. Read and execute the PostgreSQL schema script
        const schemaPath = path.join(__dirname, '../supabase_schema.sql');
        console.log(`Reading database schema from: ${schemaPath}`);
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log("Creating database tables and types...");
        // Execute schema file
        await db.query(schemaSql);
        console.log("✓ Database tables and schema verified.");

        // 2. Create Admin User
        const adminEmail = 'admin@devinquire.com';
        const adminPass = 'DevInquire2025!'; // Secure production default - user should change immediately
        const hashedPass = await bcrypt.hash(adminPass, 10);

        // Check if user already exists
        const userCheck = await db.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [adminEmail]);
        let adminId;

        if (userCheck.rows.length === 0) {
            const insertUser = `
                INSERT INTO users (email, password, name, role, status) 
                VALUES ($1, $2, 'System Alpha', 'Admin'::user_role, 'active'::user_status) 
                RETURNING id
            `;
            const userRes = await db.query(insertUser, [adminEmail, hashedPass]);
            adminId = userRes.rows[0].id;
            console.log("✓ Admin credentials provisioned.");
        } else {
            adminId = userCheck.rows[0].id;
            console.log("✓ Admin user already exists. Skipping provisioning.");
        }

        // 3. Seed Initial Projects
        const projects = [
            ['Neural Gateway', 'High-performance API mesh for distributed intelligence.', 'Rust', 'active', 98, 85],
            ['DevInquire v2.0', 'Production-ready dashboard core transition.', 'TypeScript', 'active', 100, 45]
        ];

        const seededProjectIds = [];
        for (const p of projects) {
            // Check if project exists by name
            const projectCheck = await db.query('SELECT id FROM projects WHERE name = $1 LIMIT 1', [p[0]]);
            if (projectCheck.rows.length === 0) {
                const insertProject = `
                    INSERT INTO projects (name, description, language, status, health, progress) 
                    VALUES ($1, $2, $3, $4::project_status, $5, $6) 
                    RETURNING id
                `;
                const projectRes = await db.query(insertProject, p);
                seededProjectIds.push(projectRes.rows[0].id);
            } else {
                seededProjectIds.push(projectCheck.rows[0].id);
            }
        }
        console.log("✓ Production projects indexed.");

        // 4. Seed Initial Tasks
        const projectId = seededProjectIds[0];
        
        // Check if we already have tasks seeded
        const taskCheck = await db.query('SELECT id FROM tasks WHERE project_id = $1 LIMIT 1', [projectId]);
        if (taskCheck.rows.length === 0) {
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            
            const today = new Date();

            const tasks = [
                [projectId, 'Hardening API Security', 'Implement CSRF and rate limiting.', adminId, 'in-progress', 'Critical', threeDaysFromNow, 8, JSON.stringify(['Security', 'Core'])],
                [projectId, 'Database Migration', 'Transition from mock to MySQL PDO.', adminId, 'completed', 'High', today, 5, JSON.stringify(['Database', 'Infrastructure'])]
            ];

            for (const t of tasks) {
                const insertTask = `
                    INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, points, tags) 
                    VALUES ($1, $2, $3, $4, $5::task_status, $6::task_priority, $7, $8, $9::jsonb) 
                    RETURNING id
                `;
                const taskRes = await db.query(insertTask, t);
                const taskId = taskRes.rows[0].id;

                // Seed Subtasks and comments for the first task
                if (t[1] === 'Hardening API Security') {
                    const subtasks = [
                        ['Research CSRF patterns', true, today],
                        ['Implement token validation', false, null]
                    ];
                    
                    for (const st of subtasks) {
                        const insertSubtask = `
                            INSERT INTO subtasks (task_id, title, completed, completed_at) 
                            VALUES ($1, $2, $3, $4)
                        `;
                        await db.query(insertSubtask, [taskId, st[0], st[1], st[2]]);
                    }

                    // Seed Comments
                    const comments = [
                        ['Status transitioned to IN PROGRESS', true],
                        ['Security audit pending for new tokens.', false]
                    ];

                    for (const c of comments) {
                        const insertComment = `
                            INSERT INTO task_comments (task_id, user_id, text, is_system_log) 
                            VALUES ($1, $2, $3, $4)
                        `;
                        await db.query(insertComment, [taskId, c[1] ? null : adminId, c[0], c[1]]);
                    }
                }
            }
            console.log("✓ Task backlog and telemetry initialized.");
        } else {
            console.log("✓ Tasks already exist. Skipping tasks seeding.");
        }

        console.log("\n[SUCCESS] System ready for deployment. Database setup completed successfully.\n");
        process.exit(0);
    } catch (err) {
        console.error("\n[ERROR] System malfunction during initialization:", err);
        process.exit(1);
    }
}

runSeed();
