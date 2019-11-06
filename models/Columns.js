const Columns = {
  stockFile: {
    partNumber: {
      names: ['part number', 'part', 'p/n']
    },
    qty: {
      names: ['qty']
    },
    desc: {
      names: ['description']
    }
  },
  salesDataFile: {
    country: {
      names: ['country', 'country name']
    },
    customer: {
      names: ['hwst name']
    },
    funcLoc: {
      names: ['functional location']
    }
  }
};

Columns.setIds = (fileType, firstRow) => {
  Object.keys(Columns[fileType]).forEach(key => {
    Columns[fileType][key].id = 0;
    Columns[fileType][key].data = []; // clear data
    for (let pass = 0; pass < 2; pass += 1) {
      Columns[fileType][key].names.forEach(name => {
        firstRow.eachCell((cell, colNumber) => {
          if (
            Columns[fileType][key].id < 1 &&
            ((pass === 0 && cell.value.trim().toLowerCase() === name) || // try to find exact match on initial pass
              (pass === 1 &&
                cell.value
                  .trim()
                  .toLowerCase()
                  .indexOf(name) !== -1))
          ) {
            Columns[fileType][key].id = colNumber; // eslint-disable-line no-param-reassign
          }
        });
      });
    }
  });
};

Columns.setData = (fileType, row) => {
  Object.keys(Columns[fileType]).forEach(key => {
    if (Columns[fileType][key].id > 0) {
      row.eachCell((cell, colNumber) => {
        if (Columns[fileType][key].id === colNumber) {
          Columns[fileType][key].data.push(cell.value);
        }
      });
    }
  });
};

module.exports = Columns;