export function NumCell({ v, cls }) {
  if (!v) return <span className="num-zero">0</span>;
  return <span className={cls}>{v.toLocaleString()}</span>;
}

export { NumCell as N };
