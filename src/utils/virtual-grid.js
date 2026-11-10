/**
 * 按行虚拟滚动窗口计算（固定列数的网格）。
 *
 * 根据滚动位置算出真正需要渲染的行/项区间，使 DOM 数量恒定、与总条目数无关，
 * 从而支持数百个任务卡片「真实滚动」查看而不把页面拖垮。
 */
export function getVirtualGridWindow({
  itemCount,
  scrollTop = 0,
  viewportHeight = 0,
  columns = 4,
  rowHeight = 74,
  bufferRows = 2
}) {
  const safeCount = Math.max(0, itemCount)
  const safeColumns = Math.max(1, columns)
  const rowCount = Math.ceil(safeCount / safeColumns)
  const totalHeight = rowCount * rowHeight

  const firstVisibleRow = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const visibleRowCount = Math.ceil(Math.max(0, viewportHeight) / rowHeight)
  const startRow = Math.max(0, firstVisibleRow - bufferRows)
  const endRow = Math.min(rowCount, firstVisibleRow + visibleRowCount + bufferRows)

  return {
    rowCount,
    totalHeight,
    startRow,
    endRow,
    startIndex: startRow * safeColumns,
    endIndex: Math.min(safeCount, endRow * safeColumns),
    offsetY: startRow * rowHeight
  }
}
