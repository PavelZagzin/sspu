/* eslint-disable no-restricted-syntax */
/* eslint-disable no-param-reassign */
const { ipcRenderer } = require('electron');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const Excel = require('exceljs');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const addTitleRow = require('./utils/addTitleRow');
const addMainRow = require('./utils/addMainRow');
const setColWidth = require('./utils/setColWidth');
const fillCell = require('./utils/fillCell');
const Color = require('./utils/Color');
const colNum = require('./utils/colNum');
const checkFileBusy = require('./utils/checkFileBusy');
const configFilesController = require('../configFilesController');
const contractController = require('../contractController');
const createCustomerContractFile = require('./createCustomerContractFile');
const XCol = require('./utils/XCol');

dayjs.extend(customParseFormat);

// const { Op } = sequelize;

const customerListColumns = [
  new XCol(1, 'Customer', 40, []),
  new XCol(2, 'Contract Count', 15, []),
  new XCol(3, 'Active', 10, [
    new XCol(3, 'CTR+SD', 10, []),
    new XCol(4, 'CTR', 10, []),
    new XCol(5, 'SD', 10, []),
    new XCol(6, 'ND', 10, [])
  ]),
  new XCol(7, 'Active 6m', 10, [
    new XCol(7, 'CTR+SD', 10, []),
    new XCol(8, 'CTR', 10, []),
    new XCol(9, 'SD', 10, []),
    new XCol(10, 'ND', 10, [])
  ]),
  new XCol(11, 'Expired', 10, [
    new XCol(11, 'CTR+SD', 10, []),
    new XCol(12, 'CTR', 10, []),
    new XCol(13, 'SD', 10, []),
    new XCol(14, 'ND', 10, [])
  ]),
  new XCol(15, 'No Stock', 10, [
    new XCol(15, 'CTR+SD', 10, []),
    new XCol(16, 'CTR', 10, []),
    new XCol(17, 'SD', 10, []),
    new XCol(18, 'ND', 10, [])
  ]),
  new XCol(19, 'No Stock 6m', 10, [
    new XCol(19, 'CTR+SD', 10, []),
    new XCol(20, 'CTR', 10, []),
    new XCol(21, 'SD', 10, []),
    new XCol(22, 'ND', 10, [])
  ]),
  new XCol(23, 'No Stock Expired', 10, [
    new XCol(23, 'CTR+SD', 10, []),
    new XCol(24, 'CTR', 10, []),
    new XCol(25, 'SD', 10, []),
    new XCol(26, 'ND', 10, [])
  ])
];

const replaceIllegalChars = name => {
  return name.replace(/[/\\?%*:|"<>]/g, '-');
};

const addCustomerRow = async (contract, sheet, dir) => {
  try {
    const custName = replaceIllegalChars(contract.customer) || 'NO_NAME';
    const [status, noStock] = await createCustomerContractFile(
      contract.customer,
      dir,
      custName
    );

    await sheet.addRow([
      {
        text: custName,
        hyperlink: `customers\\${custName}.xlsx`,
        tooltip: `${custName} - customers\\${custName}.xlsx`
      },
      contract.dataValues.contractNum,
      status.active.ctr + status.active.sd,
      status.active.ctr,
      status.active.sd,
      status.active.nd,
      status.active6m.ctr + status.active6m.sd,
      status.active6m.ctr,
      status.active6m.sd,
      status.active6m.nd,
      status.expired.ctr + status.expired.sd,
      status.expired.ctr,
      status.expired.sd,
      status.expired.nd,
      noStock.active.ctr + noStock.active.sd,
      noStock.active.ctr,
      noStock.active.sd,
      noStock.active.nd,
      noStock.active6m.ctr + noStock.active6m.sd,
      noStock.active6m.ctr,
      noStock.active6m.sd,
      noStock.active6m.nd,
      noStock.expired.ctr + noStock.expired.sd,
      noStock.expired.ctr,
      noStock.expired.sd,
      noStock.expired.nd
    ]);

    sheet.lastRow.getCell(1).font = {
      color: { argb: '000000ff' },
      underline: 'single'
    };

    sheet.lastRow.eachCell((cell, colNumber) => {
      if (colNumber === 15 && cell.value > 0) {
        fillCell.solid(cell, Color.RED_SOLID);
      } else if (colNumber === 19 && cell.value > 0) {
        fillCell.solid(cell, Color.RED);
      } else {
        fillCell.solid(cell, Color.WHITE);
      }
    });
    Promise.resolve();
  } catch (error) {
    Promise.reject(error);
  }
};

const contractPartUsageReport = async () => {
  try {
    const outFile = configFilesController.getOutputFile('contractUsage');
    await checkFileBusy(outFile);

    const dir = path.join(path.dirname(outFile), 'customers');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    fse.emptyDirSync(dir);

    const contractDir = path.join(path.dirname(outFile), 'contracts');
    if (!fs.existsSync(contractDir)) {
      fs.mkdirSync(contractDir);
    }
    fse.emptyDirSync(contractDir);

    const contracts = await contractController.getAllContracts();

    // eslint-disable-next-line no-const-assign
    // contracts = contracts.slice(0, 10); // test first 20 customer

    const wb = new Excel.stream.xlsx.WorkbookWriter({
      filename: outFile,
      useStyles: true,
      useSharedStrings: true
    });

    const sheet = wb.addWorksheet('Customers', {
      views: [{ state: 'frozen', ySplit: 3 }],
      properties: { tabColor: { argb: 'FFFFFFFF' } }
    });

    addTitleRow('Contract Part Usage', customerListColumns, sheet);
    addMainRow(customerListColumns, sheet);
    let curItem = 1;
    for (const contract of contracts) {
      ipcRenderer.send('set-progress', {
        mainItem: `Generating contract usage report`,
        subItem: contract.customer,
        curItem: curItem,
        totalItem: contracts.length
      });
      await addCustomerRow(contract, sheet, dir);
      curItem++;
    }

    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: sheet.lastRow._number, column: colNum(customerListColumns) }
    };

    setColWidth(customerListColumns, sheet);
    await wb.commit();
    return Promise.resolve(outFile);
  } catch (error) {
    return Promise.reject(error);
  }
};

module.exports = contractPartUsageReport;
