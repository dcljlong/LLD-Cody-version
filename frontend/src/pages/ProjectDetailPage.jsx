import React from "react";
import { useParams } from "react-router-dom";

export default function ProjectDetailPage() {
  const { id } = useParams();

  return (
    <div style={{ padding: 20 }}>
      <h2>Job Detail</h2>
      <p>Job detail page is temporarily disabled during backend alignment.</p>
      <p>Job ID: {id}</p>
    </div>
  );
}
