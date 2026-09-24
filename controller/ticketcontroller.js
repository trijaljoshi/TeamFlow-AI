const pool = require("../db/db");

// 1. Create Ticket
const createTicket = async (req, res) => {
    try {
        const projectId = req.params.projectId;

        const {
            qa_test_id,
            title,
            description,
            priority,
            due_date
        } = req.body;

        if (!title) {
            return res.status(400).json({
                message: "Ticket title is required"
            });
        }

        const result = await pool.query(
            `INSERT INTO tickets
                (project_id, qa_test_id, title, description, priority, due_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                projectId,
                qa_test_id || null,
                title,
                description || null,
                priority || "Medium",
                due_date || null
            ]
        );

        res.status(201).json({
            message: "Ticket created successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Create ticket error:", error);

        res.status(500).json({
            message: "Failed to create ticket"
        });
    }
};


// 2. Get all tickets
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

        res.status(200).json({
            tickets: result.rows
        });

    } catch (error) {
        console.error("Get all tickets error:", error);

        res.status(500).json({
            message: "Failed to fetch tickets"
        });
    }
};


// 3. Get tickets of a project
const getProjectTickets = async (req, res) => {
    try {
        const projectId = req.params.projectId;

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

        res.status(200).json({
            tickets: result.rows
        });

    } catch (error) {
        console.error("Get project tickets error:", error);

        res.status(500).json({
            message: "Failed to fetch project tickets"
        });
    }
};


// 4. Get single ticket
const getTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;

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

        res.status(200).json({
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Get ticket error:", error);

        res.status(500).json({
            message: "Failed to fetch ticket"
        });
    }
};


// 5. Claim ticket
const claimTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const userId = req.user.userId;

        const result = await pool.query(
            `UPDATE tickets
             SET claimed_by = $1
             WHERE id = $2
             AND claimed_by IS NULL
             RETURNING *`,
            [userId, ticketId]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                message: "Ticket is already claimed or does not exist"
            });
        }

        res.status(200).json({
            message: "Ticket claimed successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Claim ticket error:", error);

        res.status(500).json({
            message: "Failed to claim ticket"
        });
    }
};


// 6. Update ticket status
const updateTicketStatus = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const { status } = req.body;

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

        res.status(200).json({
            message: "Ticket status updated successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Update ticket status error:", error);

        res.status(500).json({
            message: "Failed to update ticket status"
        });
    }
};


// 7. Update ticket details
const updateTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;

        const {
            title,
            description,
            priority,
            due_date
        } = req.body;

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
                title || null,
                description || null,
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

        res.status(200).json({
            message: "Ticket updated successfully",
            ticket: result.rows[0]
        });

    } catch (error) {
        console.error("Update ticket error:", error);

        res.status(500).json({
            message: "Failed to update ticket"
        });
    }
};


// 8. Retest ticket
const retestTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;

        const ticketResult = await pool.query(
            `SELECT qa_test_id
             FROM tickets
             WHERE id = $1`,
            [ticketId]
        );

        if (ticketResult.rows.length === 0) {
            return res.status(404).json({
                message: "Ticket not found"
            });
        }

        const qaTestId = ticketResult.rows[0].qa_test_id;

        // Put ticket into Retest state
        const ticket = await pool.query(
            `UPDATE tickets
             SET status = 'Retest'
             WHERE id = $1
             RETURNING *`,
            [ticketId]
        );

        // Set linked QA test back to Pending
        if (qaTestId) {
            await pool.query(
                `UPDATE qa_tests
                 SET status = 'Pending'
                 WHERE id = $1`,
                [qaTestId]
            );
        }

        res.status(200).json({
            message: "Ticket sent for retest",
            ticket: ticket.rows[0]
        });

    } catch (error) {
        console.error("Retest ticket error:", error);

        res.status(500).json({
            message: "Failed to retest ticket"
        });
    }
};


module.exports = {
    createTicket,
    getAllTickets,
    getProjectTickets,
    getTicket,
    claimTicket,
    updateTicketStatus,
    updateTicket,
    retestTicket
};