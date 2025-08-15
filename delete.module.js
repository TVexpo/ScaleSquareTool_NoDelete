// delete.module.js - independent deletion module (no globals)
(function(global){
  function createDeleteModule({
    getSquares, getRects, setSquares, setRects, isSelected, onAfterDelete,
  }) {
    function deleteSelected() {
      const before = getSquares().length + getRects().length;
      const newSquares = getSquares().filter(s => !isSelected(s));
      const newRects  = getRects().filter(r => !isSelected(r));
      const after = newSquares.length + newRects.length;
      if (after !== before) {
        setSquares(newSquares);
        setRects(newRects);
        onAfterDelete && onAfterDelete({ deletedCount: before - after });
        return true;
      }
      onAfterDelete && onAfterDelete({ deletedCount: 0 });
      return false;
    }

    let _keyHandler = null;
    function bindUI({ deleteBtn, win }) {
      if (deleteBtn) deleteBtn.addEventListener('click', deleteSelected);
      if (win) {
        _keyHandler = (e) => {
          if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
        };
        win.addEventListener('keydown', _keyHandler);
      }
      return () => {
        if (deleteBtn) deleteBtn.removeEventListener('click', deleteSelected);
        if (win && _keyHandler) win.removeEventListener('keydown', _keyHandler);
        _keyHandler = null;
      };
    }

    return { deleteSelected, bindUI };
  }
  global.CreateDeleteModule = createDeleteModule;
})(window);
