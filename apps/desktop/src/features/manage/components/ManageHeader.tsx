import React from "react";

const ManageHeader: React.FC = () => {
  return (
    <header className="mb-6 rounded-xl border border-[var(--lumina-border)] bg-[var(--lumina-surface)]/50 px-5 py-4 backdrop-blur-sm">
      <h1 className="text-2xl font-semibold text-[var(--lumina-text)]">照片管理</h1>
      <p className="mt-1 text-sm text-[var(--lumina-muted)]">浏览、筛选和管理已写入仓库的照片</p>
    </header>
  );
};

export default ManageHeader;
