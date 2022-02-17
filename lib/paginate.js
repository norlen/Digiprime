/**
 * Returns elementPerPage number of elements from the array passed. The array should be sorted
 * before passed here.
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
  };
};
