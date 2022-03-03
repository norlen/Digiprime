/**
 * Parses a value into a page number.
 *
 * Clamps the number into a range of [1, 1_000_000]. If it's not a valid number
 * 1 is returned.
 *
 * @param {any} page
 * @returns
 */
module.exports.getPage = (page) => {
  try {
    let n = typeof page === "number" ? page : parseInt(page);
    if (isNaN(n)) {
      n = 1;
    }
    return Math.max(1, Math.min(n, 1_000_000));
  } catch (err) {
    return 1;
  }
};

/**
 * Creates a pagination object that can be passed to the partial that renders
 * the pagination view.
 *
 * @param {any[]} data
 * @param {number} size
 * @param {number} currentPage
 * @param {number} perPage
 * @returns {
 *  data: any[],
 *  currentPage: number,
 *  totalPages: number,
 *  perPage: number,
 * }
 */
module.exports.createPagination = (
  data,
  size,
  currentPage,
  perPage,
  query = {}
) => {
  const totalPages = Math.ceil(size / perPage);
  return {
    data,
    currentPage: Math.max(1, Math.min(currentPage, totalPages)),
    totalPages,
    perPage,
    query,
  };
};

/**
 * Returns elementPerPage number of elements from the array passed. The array
 * should be sorted before passed here.
 *
 * @param {any[]} array
 * @param {number} page
 * @param {number} elementsPerPage
 * @returns array with elements from the current page.
 */
module.exports.paginate = (array, currentPage, elementsPerPage) => {
  const totalPages = Math.floor(array.length / elementsPerPage) + 1;
  let currPage = 1;

  try {
    if (typeof currentPage === "number") {
      currPage = Math.max(1, currentPage);
    }
    if (typeof currentPage === "string") {
      const parsed = parseInt(currentPage);
      if (!isNaN(parsed)) {
        currPage = Math.max(1, parsed);
      }
    }
  } catch (err) {}

  // Pages are 1-indexed, so convert to zero index.
  const startIdx = (currPage - 1) * elementsPerPage;
  const data = array.splice(startIdx, elementsPerPage);

  return {
    data,
    currentPage: currPage,
    totalPages,
    perPage: elementsPerPage,
    query: {},
  };
};
