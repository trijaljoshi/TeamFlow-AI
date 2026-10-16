import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import {
  apiGet,
  getArray,
  getCurrentUserId,
  normalizeStatus,
  formatDate,
} from "./workspaceApi.js";

function Notifications() {
  const [tasks, setTasks] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const userId = getCurrentUserId();

  useEffect(() => {
    Promise.all([
      apiGet("/all-tasks"),
      apiGet("/tickets"),
    ])
      .then(([taskData, ticketData]) => {
        setTasks(getArray(taskData, ["tasks", "data"]));
        setTickets(getArray(ticketData, ["tickets", "data"]));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const notifications = useMemo(() => {
    const now = new Date();
    const result = [];

    tasks
      .filter((task) => {
        const owner =
          task.assigned_to ??
          task.assignee_id ??
          task.assigneeId ??
          task.claimed_by ??
          task.claimedBy;
        return owner != null && String(owner) === String(userId);
      })
      .forEach((task) => {
        if (task.due_date) {
          const due = new Date(task.due_date);
          if (!Number.isNaN(due.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDay = new Date(due);
            dueDay.setHours(0, 0, 0, 0);
            const days = Math.ceil(
              (dueDay - today) / 86400000
            );

            if (days < 0) {
              result.push({
                type: "deadline",
                tone: "danger",
                title: "Task is overdue",
                text: `"${task.title}" is overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}.`,
                date: due,
              });
            } else if (days <= 2) {
              result.push({
                type: "deadline",
                tone: "warning",
                title: days === 0 ? "Task is due today" : "Upcoming deadline",
                text: `"${task.title}" is due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}.`,
                date: due,
              });
            }
          }
        }

        if (["COMPLETED", "COMPLETE", "DONE"].includes(normalizeStatus(task.status))) {
          result.push({
            type: "task",
            tone: "success",
            title: "Task completed",
            text: `"${task.title}" has been marked completed and is awaiting QA.`,
            date: task.updated_at || task.completed_at,
          });
        }
      });

    tickets
      .filter((ticket) => {
        const claimed =
          ticket.claimed_by ??
          ticket.claimedBy;
        return claimed != null && String(claimed) === String(userId);
      })
      .forEach((ticket) => {
        result.push({
          type: "ticket",
          tone: "info",
          title: "Ticket claimed",
          text: `You are working on "${ticket.title || `Ticket #${ticket.id}`}".`,
          date: ticket.updated_at || ticket.created_at,
        });

        if (ticket.due_date || ticket.deadline) {
          const due = new Date(ticket.due_date || ticket.deadline);
          if (!Number.isNaN(due.getTime()) && due >= now) {
            result.push({
              type: "deadline",
              tone: "warning",
              title: "Ticket deadline",
              text: `"${ticket.title || "Ticket"}" is due on ${formatDate(due)}.`,
              date: due,
            });
          }
        }
      });

    return result
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 30);
  }, [tasks, tickets, userId]);

  return (
    <DashboardLayout>
      <div className="teamflow-page workspace-page">
        <section className="teamflow-heading">
          <p className="welcome-label">SYSTEM UPDATES</p>
          <h2>Your notifications.</h2>
          <p className="welcome-description">
            Deadlines, task events and ticket updates that need your attention.
          </p>
        </section>

        {error && <div className="workspace-alert">{error}</div>}

        <section className="workspace-panel">
          <div className="workspace-panel-head">
            <div>
              <p className="welcome-label">OFFICIAL ALERTS</p>
              <h3>Recent updates</h3>
            </div>
            <span className="workspace-count">{notifications.length}</span>
          </div>

          {loading ? (
            <div className="workspace-empty">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="workspace-empty">
              <strong>No new notifications</strong>
              <p>Deadline alerts and task/ticket updates will appear here.</p>
            </div>
          ) : (
            <div className="workspace-list">
              {notifications.map((item, index) => (
                <article className={`workspace-row tone-${item.tone}`} key={`${item.type}-${index}`}>
                  <div className="workspace-row-icon">
                    {item.type === "deadline" ? "!" : item.type === "ticket" ? "#" : "✓"}
                  </div>
                  <div className="workspace-row-main">
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                  <time>{formatDate(item.date)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

export default Notifications;
