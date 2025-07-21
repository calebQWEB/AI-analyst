import React from "react";
import ProgressStepper from "./_components/ProgressStepper";

const layout = ({ children }) => {
  return (
    <div>
      <ProgressStepper />
      {children}
    </div>
  );
};

export default layout;
