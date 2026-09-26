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
    completeTicket,
    retestTicket
} = require("../controller/ticketcontroller");

const authMiddleware = require("../middleware/authmiddleware");


// =====================================================
// CREATE TICKET
// POST /api/projects/:projectId/tickets
// =====================================================

router.post(
    "/projects/:projectId/tickets",
    authMiddleware,
    createTicket
);


// =====================================================
// GET ALL TICKETS
// GET /api/tickets
// =====================================================

router.get(
    "/tickets",
    authMiddleware,
    getAllTickets
);


// =====================================================
// GET PROJECT TICKETS
// GET /api/projects/:projectId/tickets
// =====================================================

router.get(
    "/projects/:projectId/tickets",
    authMiddleware,
    getProjectTickets
);


// =====================================================
// GET SINGLE TICKET
// GET /api/tickets/:ticketId
// =====================================================

router.get(
    "/tickets/:ticketId",
    authMiddleware,
    getTicket
);


// =====================================================
// CLAIM TICKET
// POST /api/tickets/:ticketId/claim
// =====================================================

router.post(
    "/tickets/:ticketId/claim",
    authMiddleware,
    claimTicket
);


// =====================================================
// COMPLETE TICKET
// PATCH /api/tickets/:ticketId/complete
// =====================================================

router.patch(
    "/tickets/:ticketId/complete",
    authMiddleware,
    completeTicket
);


// =====================================================
// UPDATE TICKET STATUS
// PATCH /api/tickets/:ticketId/status
// =====================================================

router.patch(
    "/tickets/:ticketId/status",
    authMiddleware,
    updateTicketStatus
);


// =====================================================
// UPDATE TICKET DETAILS
// PATCH /api/tickets/:ticketId
// =====================================================

router.patch(
    "/tickets/:ticketId",
    authMiddleware,
    updateTicket
);


// =====================================================
// RETEST TICKET
// POST /api/tickets/:ticketId/retest
// =====================================================

router.post(
    "/tickets/:ticketId/retest",
    authMiddleware,
    retestTicket
);


module.exports = router;