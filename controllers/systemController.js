/* eslint-disable no-restricted-syntax */
const { ipcRenderer } = require('electron');
const sequelize = require('sequelize');
const db = require('../db');
const System = require('../models/System');
const Product = require('../models/Product');
const Serial = require('../models/Serial');
const Part = require('../models/Part');
// const PartFieldEquiv = require('../models/PartFieldEquiv');
// const Stock = require('../models/Stock');
const serialController = require('./serialController');
const Contract = require('../models/Contract');

// const { Op } = sequelize;

exports.addOneSystem = system => {
  return new Promise((resolve, reject) => {
    const serialList = system.serialList.join(',');

    System.findCreateFind({
      where: {
        contractId: system.contractId,
        productId: system.productId
      },
      defaults: {
        contractId: system.contractId,
        productId: system.productId,
        serialList: serialList,
        serialId: system.serialId,
        qty: system.qty
      }
    })
      .then(([systemdb, created]) => {
        console.log(
          created
            ? `Added system with serial list ${systemdb.serialList}`
            : `Updated system with serial ${systemdb.serialList}`
        );
        resolve(systemdb.dataValues);
      })
      .catch(err => {
        reject(err);
      });
  });
};

exports.addSystems = async (systemsData, productIds, contractIds) => {
  try {
    const tot = Object.keys(systemsData).length;
    let cur = 1;
    for (const i in systemsData) {
      if ({}.hasOwnProperty.call(systemsData, i)) {
        const sys = systemsData[i];

        ipcRenderer.send('set-progress', {
          mainItem: 'Importing systems',
          subItem: `${sys.contract} ${sys.product}`,
          curItem: cur,
          totalItem: tot
        });
        cur++;

        let serialId = null;

        if (sys.serialList.length > 128) {
          sys.serialList = sys.serialList.slice(0, 127);
        }

        if (sys.serialList.length) {
          serialId = await serialController.addSerialList({
            serialList: sys.serialList,
            productNumber: sys.product
          });
        }

        await this.addOneSystem({
          contractId: contractIds[sys.contract],
          productId: productIds[sys.product],
          serialList: sys.serialList,
          serialId: serialId,
          qty: sys.qty
        });
      }
    }
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
};

exports.clearSystems = async () => {
  try {
    await System.destroy({ where: {}, truncate: true });
    await db.query("UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE NAME='systems'");

    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error);
  }
};

exports.findSystemsWithPart = async partIds => {
  try {
    const systems = await System.findAll({
      where: {},
      include: [
        {
          model: Contract,
          required: true
        },
        {
          model: Product,
          where: { exclude: false },
          required: true,
          include: [
            {
              model: Part,
              required: true,
              where: { id: partIds, exclude: false }
            }
          ]
        },
        {
          model: Serial,
          include: [
            {
              model: Part,
              required: true,
              where: { id: partIds, exclude: false }
            }
          ]
        }
      ]
    });

    return Promise.resolve(systems);
  } catch (error) {
    return Promise.reject(error);
  }
};

// exports.findSystemsWithProductId = async productId => {
//   try {
//     const systems = await System.findAll({
//       where: { productId: productId },
//       include: [
//         {
//           model: Contract,
//           required: true
//         },
//         {
//           model: Product,
//           required: true,
//           where: { exclude: false },
//           include: [
//             {
//               model: Part,
//               where: { exclude: false },
//               include: [
//                 { model: Stock },
//                 { model: Part, as: 'fePart', include: [{ model: Stock }] }
//                 // { model: 'fePart' } // , include: [{ model: Stock }] }
//               ]
//             }
//           ]
//         },
//         {
//           model: Serial,
//           include: [
//             {
//               model: Part,
//               required: true,
//               where: { exclude: false },
//               include: [
//                 { model: Stock },
//                 { model: Part, as: 'fePart', include: [{ model: Stock }] }
//                 // { model: 'fePart' } // , include: [{ model: Stock }] }
//               ]
//             }
//           ]
//         }
//       ]
//     });
//     return Promise.resolve(systems);
//   } catch (error) {
//     return Promise.reject(error);
//   }
// };

exports.findSystemsWithCustomer = async customer => {
  try {
    const systems = await System.findAll({
      include: [
        {
          model: Contract,
          where: {
            customer: customer
          },
          required: true
        },
        {
          model: Product,
          required: true
        },
        {
          model: Serial,
          // required: true,
          include: [
            {
              model: Part,
              required: true
            }
          ]
        }
      ]
    });

    // const systemsWithSerial = await System.findAll({
    //   where: { serialId: { [Op.not]: null } },
    //   include: [
    //     {
    //       model: Contract,
    //       where: { customer: customer },
    //       required: true
    //     },
    //     {
    //       model: Product,
    //       required: true,
    //       include: [
    //         {
    //           model: Part,
    //           required: true
    //         }
    //       ]
    //     },
    //     {
    //       model: Serial,
    //       required: true,
    //       include: [
    //         {
    //           model: Part,
    //           required: true
    //         }
    //       ]
    //     }
    //   ]
    // });

    // const systemNoSerial = await System.findAll({
    //   where: { serialId: null },
    //   include: [
    //     {
    //       model: Contract,
    //       where: { customer: customer },
    //       required: true
    //     },
    //     {
    //       model: Product,
    //       required: true,
    //       include: [
    //         {
    //           model: Part,
    //           required: true
    //         }
    //       ]
    //     }
    //   ]
    // });

    // const systems = [...systemsWithSerial, ...systemNoSerial]; // , ...systemLinked];
    return Promise.resolve(systems);
  } catch (error) {
    return Promise.reject(error);
  }
};

exports.getAllSystems = async () => {
  try {
    const systems = await System.findAll({
      attributes: [
        'productId',
        [sequelize.fn('COUNT', sequelize.col('productId')), 'productCount']
      ],
      include: [{ model: Product, where: { exclude: false } }],
      group: ['productId'],
      order: [[sequelize.fn('COUNT', sequelize.col('productId')), 'DESC']]
    });

    return Promise.resolve(systems);
  } catch (error) {
    return Promise.reject(error);
  }
};
