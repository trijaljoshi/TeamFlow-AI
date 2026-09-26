const pool = require("../db/db");


// =====================================================
// 1. CREATE TICKET
// POST /api/projects/:projectId/tickets
// =====================================================

const createTicket = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);

        const {
            qa_test_id,
            title,
            description,
            priority,
            due_date
        } = req.body;

        if (!projectId) {
            return res.status(400).json({
                message: "Valid projectId is required"
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Ticket title is required"
            });
        }

        // If ticket is linked to a QA test,
        // verify that QA test belongs to this project.
        if (qa_test_id) {
            const qaResult = await pool.query(
                `SELECT id, project_id, task_id
                 FROM qa_tests
                 WHERE id = $1
                   AND project_id = $2`,
                [qa_test_id, projectId]
            );

            if (qaResult.rows.length === 0) {
                return res.status(400).json({
                    message: "The selected QA test does not belong to this project"
                });
            }

            // Prevent multiple active tickets for the same QA test.
            const existingTicket = await pool.query(
                `SELECT id, status
                 FROM tickets
                 WHERE qa_test_id = $1
                   AND UPPER(COALESCE(status, 'OPEN')) NOT IN
                       ('COMPLETED', 'COMPLETE', 'DONE', 'CLOSED', 'RESOLVED')
                 LIMIT 1`,
                [qa_test_id]
            );

            if (existingTicket.rows.length > 0) {
                return res.status(409).json({
                    message: "An active ticket already exists for this QA test",
                    ticket: existingTicket.rows[0]
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO tickets
                (
                    project_id,
                    qa_test_id,
                    title,
                    description,
                    priority,
                    due_date
                )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                projectId,
                qa_test_id || null,
                title.trim(),
                description?.trim() || null,
                priority || "Medium",
                due_date || null
            ]
        );

        return res.status(201).json({
            message: "Ticket created successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Create ticket error:", error);

        return res.status(500).json({
            message: "Failed to create ticket"
        });
    }
};


// =====================================================
// 2. GET ALL TICKETS
// GET /api/tickets
// =====================================================

const getAllTickets = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                tickets.*,
                projects.name AS project_name,
                users.name AS claimed_by_name
             FROM tickets
             LEFT JOIN projects
                ON tickets.project_id = projects.id
             LEFT JOIN users
                ON tickets.claimed_by = users.id
             ORDER BY tickets.created_at DESC`
        );

        return res.status(200).json({
            tickets: result.rows
        });

    } catch (error) {
        console.error("Get all tickets error:", error);

        return res.status(500).json({
            message: "Failed to fetch tickets"
        });
    }
};


// =====================================================
// 3. GET PROJECT TICKETS
// GET /api/projects/:projectId/tickets
// =====================================================

const getProjectTickets = async (req, res) => {
    try {
        const projectId = Number(req.params.projectId);

        if (!projectId) {
            return res.status(400).json({
                message: "Valid projectId is required"
            });
        }

        const result = await pool.query(
            `SELECT
                tickets.*,
                users.name AS claimed_by_name
             FROM tickets
             LEFT JOIN users
                ON tickets.claimed_by = users.id
             WHERE tickets.project_id = $1
             ORDER BY tickets.created_at DESC`,
            [projectId]
        );

        return res.status(200).json({
            tickets: result.rows
        });

    } catch (error) {
        console.error("Get project tickets error:", error);

        return res.status(500).json({
            message: "Failed to fetch project tickets"
        });
    }
};


// =====================================================
// 4. GET SINGLE TICKET
// GET /api/tickets/:ticketId
// =====================================================

const getTicket = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        const result = await pool.query(
            `SELECT
                tickets.*,
                projects.name AS project_name,
                users.name AS claimed_by_name
             FROM tickets
             LEFT JOIN projects
                ON tickets.project_id = projects.id
             LEFT JOIN users
                ON tickets.claimed_by = users.id
             WHERE tickets.id = $1`,
            [ticketId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        return res.status(200).json({
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Get ticket error:", error);

        return res.status(500).json({
            message: "Failed to fetch ticket"
        });
    }
};


// =====================================================
// 5. CLAIM TICKET
// POST /api/tickets/:ticketId/claim
// =====================================================

const claimTicket = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);

        const userId =
            req.user?.userId ??
            req.user?.id;

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        if (!userId) {
            return res.status(401).json({
                message: "Authenticated user not found"
            });
        }

        const result = await pool.query(
            `UPDATE tickets
             SET claimed_by = $1
             WHERE id = $2
               AND claimed_by IS NULL
               AND UPPER(COALESCE(status, 'OPEN'))
                   NOT IN ('COMPLETED', 'COMPLETE', 'DONE', 'CLOSED', 'RESOLVED')
             RETURNING *`,
            [userId, ticketId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Ticket is already claimed, completed, or does not exist"
            });
        }

        return res.status(200).json({
            message: "Ticket claimed successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Claim ticket error:", error);

        return res.status(500).json({
            message: "Failed to claim ticket"
        });
    }
};


// =====================================================
// 6. UPDATE TICKET STATUS
// PATCH /api/tickets/:ticketId/status
// =====================================================

const updateTicketStatus = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);
        const { status } = req.body;

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        if (!status) {
            return res.status(400).json({
                message: "Status is required"
            });
        }

        const result = await pool.query(
            `UPDATE tickets
             SET status = $1
             WHERE id = $2
             RETURNING *`,
            [status, ticketId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        return res.status(200).json({
            message: "Ticket status updated successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Update ticket status error:", error);

        return res.status(500).json({
            message: "Failed to update ticket status"
        });
    }
};


// =====================================================
// 7. UPDATE TICKET DETAILS
// PATCH /api/tickets/:ticketId
// =====================================================

const updateTicket = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);

        const {
            title,
            description,
            priority,
            due_date
        } = req.body;

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        const result = await pool.query(
            `UPDATE tickets
             SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                priority = COALESCE($3, priority),
                due_date = COALESCE($4, due_date)
             WHERE id = $5
             RETURNING *`,
            [
                title?.trim() || null,
                description?.trim() || null,
                priority || null,
                due_date || null,
                ticketId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        return res.status(200).json({
            message: "Ticket updated successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Update ticket error:", error);

        return res.status(500).json({
            message: "Failed to update ticket"
        });
    }
};


// =====================================================
// 8. RETEST TICKET
// POST /api/tickets/:ticketId/retest
// =====================================================

const retestTicket = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        const ticketResult = await pool.query(
            `SELECT
                tickets.id,
                tickets.qa_test_id,
                qa_tests.task_id
             FROM tickets
             LEFT JOIN qa_tests
                ON qa_tests.id = tickets.qa_test_id
             WHERE tickets.id = $1`,
            [ticketId]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        const ticketData = ticketResult.rows[0];

        const ticket = await pool.query(
            `UPDATE tickets
             SET status = 'Retest'
             WHERE id = $1
             RETURNING *`,
            [ticketId]
        );

        if (ticketData.qa_test_id) {
            await pool.query(
                `UPDATE qa_tests
                 SET status = 'PENDING'
                 WHERE id = $1`,
                [ticketData.qa_test_id]
            );
        }

        if (ticketData.task_id) {
            await pool.query(
                `UPDATE tasks
                 SET qa_status = 'PENDING'
                 WHERE id = $1`,
                [ticketData.task_id]
            );
        }

        return res.status(200).json({
            message: "Ticket sent for retest",
            ticket: ticket.rows[0]
        });

    } catch (error) {
        console.error("Retest ticket error:", error);

        return res.status(500).json({
            message: "Failed to retest ticket"
        });
    }
};


// =====================================================
// 9. COMPLETE TICKET
// PATCH /api/tickets/:ticketId/complete
//
// Only the person who claimed the ticket can complete it.
// After completion:
// ticket -> COMPLETED
// QA test -> PENDING
// task -> PENDING QA
// =====================================================

const completeTicket = async (req, res) => {
    try {
        const ticketId = Number(req.params.ticketId);

        const userId =
            req.user?.userId ??
            req.user?.id;

        if (!ticketId) {
            return res.status(400).json({
                message: "Valid ticketId is required"
            });
        }

        if (!userId) {
            return res.status(401).json({
                message: "Authenticated user not found"
            });
        }

        // First get the ticket and linked QA/task information.
        const ticketResult = await pool.query(
            `SELECT
                tickets.id,
                tickets.project_id,
                tickets.qa_test_id,
                tickets.claimed_by,
                qa_tests.task_id
             FROM tickets
             LEFT JOIN qa_tests
                ON qa_tests.id = tickets.qa_test_id
             WHERE tickets.id = $1`,
            [ticketId]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        const ticketData = ticketResult.rows[0];

        // Only the person who claimed the ticket can complete it.
        if (
            String(ticketData.claimed_by) !==
            String(userId)
        ) {
            return res.status(403).json({
                message:
                    "Only the person who claimed this ticket can complete it"
            });
        }

        // Complete ticket.
        const result = await pool.query(
            `UPDATE tickets
             SET status = 'COMPLETED'
             WHERE id = $1
               AND claimed_by = $2
             RETURNING *`,
            [ticketId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Ticket could not be completed"
            });
        }

        const ticket = result.rows[0];

        // Re-open the linked QA test for retesting.
        if (ticketData.qa_test_id) {
            await pool.query(
                `UPDATE qa_tests
                 SET status = 'PENDING'
                 WHERE id = $1`,
                [ticketData.qa_test_id]
            );
        }

        // Re-open task QA status.
        if (ticketData.task_id) {
            await pool.query(
                `UPDATE tasks
                 SET qa_status = 'PENDING'
                 WHERE id = $1`,
                [ticketData.task_id]
            );
        }

        return res.status(200).json({
            message:
                "Ticket completed and task returned to QA",
            ticket
        });

    } catch (error) {
        console.error("Complete ticket error:", error);

        return res.status(500).json({
            message: "Failed to complete ticket"
        });
    }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    createTicket,
    getAllTickets,
    getProjectTickets,
    getTicket,
    claimTicket,
    updateTicketStatus,
    updateTicket,
    completeTicket,
    retestTicket
};