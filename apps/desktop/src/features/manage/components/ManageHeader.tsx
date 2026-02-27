import React from "react";

const ManageHeader: React.FC = () => {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold">照片管理</h1>
      <p className="text-zinc-400 mt-2">浏览、筛选和管理已写入仓库的照片</p>
    </header>
  );
};

export default ManageHeader;
