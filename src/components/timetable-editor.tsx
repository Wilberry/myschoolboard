"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { TimetableSnapshot } from "@/src/modules/timetable/read-setup";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function minuteValue(value: string): number | null {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function localClock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function TimetableEditor({
  schoolId,
  snapshot,
}: {
  schoolId: string;
  snapshot: TimetableSnapshot;
}) {
  const router = useRouter();
  const [selectedTermId, setSelectedTermId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedTerm = snapshot.terms.find(
    (term) => term.id === selectedTermId,
  );
  const validAssignments = snapshot.assignments.filter(
    (assignment) => assignment.sessionId === selectedTerm?.sessionId,
  );

  async function submit(
    endpoint: string,
    body: Record<string, unknown>,
    successMessage: string,
    form: HTMLFormElement,
  ) {
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/schools/${encodeURIComponent(schoolId)}/timetable/${endpoint}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? "This teacher, class or room is already booked, or the request conflicts with the timetable."
            : response.status === 400
              ? "Check the selected period, weekday and start/end times."
              : response.status === 401 || response.status === 404
                ? "The school, term or assignment is unavailable, or you no longer have permission."
                : "The change could not be saved. Please try again.",
        );
        return;
      }
      form.reset();
      setSuccess(successMessage);
      router.refresh();
    } catch {
      setError(
        "Network connection failed. No successful change was confirmed.",
      );
    } finally {
      setPending(false);
    }
  }

  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void submit(
      "rooms",
      {
        name: String(data.get("name") ?? "").trim(),
        reason: String(data.get("reason") ?? "").trim(),
      },
      "Room saved. Refreshing the timetable.",
      form,
    );
  }

  function createSlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const startMinute = minuteValue(String(data.get("startTime") ?? ""));
    const endMinute = minuteValue(String(data.get("endTime") ?? ""));
    if (
      startMinute === null ||
      endMinute === null ||
      startMinute >= endMinute
    ) {
      setError("Choose a valid start time before the end time.");
      return;
    }
    void submit(
      "slots",
      {
        termId: String(data.get("termId") ?? ""),
        assignmentId: String(data.get("assignmentId") ?? ""),
        ...(data.get("roomId") ? { roomId: String(data.get("roomId")) } : {}),
        weekday: Number(data.get("weekday")),
        startMinute,
        endMinute,
        reason: String(data.get("reason") ?? "").trim(),
      },
      "Timetable slot saved. The schedule is refreshing.",
      form,
    );
  }

  function cancelSlot(event: FormEvent<HTMLFormElement>, slotId: string) {
    event.preventDefault();
    if (!window.confirm("Cancel this slot? Its history will be preserved."))
      return;
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") ?? "").trim();
    void submit(
      `slots/${encodeURIComponent(slotId)}/cancel`,
      { reason },
      "Timetable slot cancelled and recorded.",
      form,
    );
  }

  return (
    <div className="setup-workspace">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="setup-success" role="status">
          {success}
        </p>
      )}
      <section className="setup-panel" aria-labelledby="timetable-room-title">
        <h2 id="timetable-room-title">Rooms</h2>
        <p>
          Rooms have school-specific names. An unassigned room is also allowed.
        </p>
        <form onSubmit={createRoom}>
          <label>
            Room name
            <input
              name="name"
              minLength={2}
              maxLength={32}
              required
              placeholder="Science Lab"
            />
          </label>
          <label>
            Reason
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Create room"}
          </button>
        </form>
        <ul className="setup-records">
          {snapshot.rooms.map((room) => (
            <li key={room.id}>{room.name}</li>
          ))}
          {snapshot.rooms.length === 0 && <li>No rooms configured yet.</li>}
        </ul>
      </section>

      <section className="setup-panel" aria-labelledby="timetable-slot-title">
        <h2 id="timetable-slot-title">Schedule a lesson</h2>
        <p>
          Choose an active term and a teacher assigned to that academic session.
        </p>
        <form onSubmit={createSlot}>
          <label>
            Active term
            <select
              name="termId"
              required
              value={selectedTermId}
              onChange={(event) => setSelectedTermId(event.target.value)}
            >
              <option value="">Select a term</option>
              {snapshot.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Class, subject and teacher
            <select
              key={selectedTermId}
              name="assignmentId"
              required
              defaultValue=""
            >
              <option value="">Select an assignment</option>
              {validAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Room (optional)
            <select name="roomId" defaultValue="">
              <option value="">No assigned room</option>
              {snapshot.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Weekday
            <select name="weekday" required defaultValue="1">
              {weekdays.map((day, index) => (
                <option value={index + 1} key={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input name="startTime" type="time" required />
          </label>
          <label>
            End time
            <input name="endTime" type="time" required />
          </label>
          <label>
            Reason
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
          <button
            type="submit"
            disabled={pending || validAssignments.length === 0}
          >
            {pending ? "Saving…" : "Schedule lesson"}
          </button>
        </form>
      </section>

      <section
        className="setup-panel timetable-list-panel"
        aria-labelledby="timetable-existing-title"
      >
        <h2 id="timetable-existing-title">Active weekly bookings</h2>
        <p>Slots have school-local times. Adjacent slots do not conflict.</p>
        <ul className="setup-records">
          {snapshot.slots.map((slot) => (
            <li key={slot.id}>
              <strong>
                {weekdays[slot.weekday - 1]} · {localClock(slot.startMinute)}–
                {localClock(slot.endMinute)}
              </strong>
              <span>
                {snapshot.assignments.find(
                  (item) => item.id === slot.assignmentId,
                )?.label ??
                  "Teacher assignment unavailable — cancel if obsolete"}
              </span>
              <span>
                {snapshot.terms.find((term) => term.id === slot.termId)
                  ?.label ?? "Term unavailable"}
                {" · "}
                {snapshot.rooms.find((room) => room.id === slot.roomId)?.name ??
                  "No room"}
              </span>
              <form
                className="setup-status-form"
                onSubmit={(event) => cancelSlot(event, slot.id)}
              >
                <label>
                  Cancellation reason
                  <input name="reason" minLength={5} maxLength={500} required />
                </label>
                <button type="submit" disabled={pending}>
                  Cancel slot
                </button>
              </form>
            </li>
          ))}
          {snapshot.slots.length === 0 && (
            <li>No active timetable slots yet.</li>
          )}
        </ul>
      </section>
      <p className="workspace-note">
        This administrative view displays at most 100 active rooms and terms,
        and 200 teacher assignments and slots. Past bookings and cancelled
        events remain in protected audit history; students have no access to
        this interface.
      </p>
    </div>
  );
}
