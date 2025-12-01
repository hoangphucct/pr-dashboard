/**
 * SweetAlert2 Helper Functions
 * Provides simplified API for common SweetAlert2 operations
 */
const SwalHelper = {
  /**
   * Show confirmation dialog
   * @param {string} title - Dialog title
   * @param {string} text - Dialog message
   * @param {string} confirmText - Confirm button text (default: 'Yes, delete it!')
   * @param {string} cancelText - Cancel button text (default: 'Cancel')
   * @returns {Promise} SweetAlert2 result
   */
  confirm: async (title, text, confirmText = 'Yes, delete it!', cancelText = 'Cancel') => {
    return await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
    });
  },

  /**
   * Show loading dialog
   * @param {string} title - Loading title
   * @param {string} text - Loading message
   * @returns {object} SweetAlert2 instance
   */
  loading: (title, text) => {
    return Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  },

  /**
   * Show success message
   * @param {string} title - Success title
   * @param {string} text - Success message
   * @param {number} timer - Auto close timer in ms (default: 1500, 0 to disable)
   * @returns {Promise} SweetAlert2 result
   */
  success: async (title, text, timer = 1500) => {
    return await Swal.fire({
      title,
      text,
      icon: 'success',
      confirmButtonColor: '#28a745',
      confirmButtonText: 'OK',
      timer,
      timerProgressBar: timer > 0,
    });
  },

  /**
   * Show error message
   * @param {string} title - Error title
   * @param {string} text - Error message
   * @returns {Promise} SweetAlert2 result
   */
  error: async (title, text) => {
    return await Swal.fire({
      title,
      text,
      icon: 'error',
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'OK',
    });
  },

  /**
   * Close current dialog
   */
  close: () => {
    Swal.close();
  },
};
