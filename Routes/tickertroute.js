const express = require("express");

const router = express.Router();

const {
    createTicket,
    getAllTickets,
    getProjectTickets,
    getTicket,
    claimTicket,
    updateTicketStatus,
    updateTicket,
    retestTicket
} = require("../controller/ticketcontroller");

const authMiddleware = require("../middleware/authmiddleware");

// Create ticket
router.post(
    "/projects/:projectId/tickets",
    authMiddleware,
    createTicket
);

// Get all tickets
router.get(
    "/tickets",
    authMiddleware,
    getAllTickets
);

// Get tickets for a project
router.get(
    "/projects/:projectId/tickets",
    authMiddleware,
    getProjectTickets
);

// Get single ticket
router.get(
    "/tickets/:ticketId",
    authMiddleware,
    getTicket
);

// Claim ticket
router.post(
    "/tickets/:ticketId/claim",
    authMiddleware,
    claimTicket
);

// Update ticket status
router.patch(
    "/tickets/:ticketId/status",
    authMiddleware,
    updateTicketStatus
);

// Update ticket details
router.patch(
    "/tickets/:ticketId",
    authMiddleware,
    updateTicket
);

// Retest ticket
router.post(
    "/tickets/:ticketId/retest",
    authMiddleware,
    retestTicket
);

module.exports = router;