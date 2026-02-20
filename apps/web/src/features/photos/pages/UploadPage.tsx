import React from "react";
import { Navigate } from "react-router-dom";

const UploadPage: React.FC = () => {
  return <Navigate to="/manage" replace />;
};

export default UploadPage;
