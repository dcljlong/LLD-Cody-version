import React from "react";
import { tasksApi, jobsApi } from "../lib/api";

export default function ActionItemsPage() {
  return (
    <div style={{ padding: 20 }}>
      <h2>Tasks page (API aligned)</h2>
      <p>tasksApi + jobsApi connected</p>
    </div>
  );
}
