import express from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma/index.js';
import { ownerauth, customerauth } from '../middlewares/auth.middleware.js';

const router = express.Router();
// POST /:categoryId/menus, GET /:categoryId/menus를 위한 schema
const categorySchema = Joi.object({
  categoryId: Joi.number().integer().required(),
});
//GET /:categoryId/menus/:menuId, PUT /:categoryId/menus/:menuId, DELETE /:categoryId/menus/:menuId를 위한 schema
const categoryandmenuSchema = Joi.object({
  categoryId: Joi.number().integer().required(),
  menuId: Joi.number().integer().required(),
});
// POST /:categoryId/menus를 위한 schema
const menuSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  image: Joi.string().required(),
  price: Joi.number().min(0).required(),
  stock: Joi.number().min(0).required(),
});
// PUT /:categoryId/menus/:menuId를 위한 schema
const menuStatusSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  stock: Joi.number().min(0).required(),
  order: Joi.number().integer().required(),
  status: Joi.string().valid('FOR_SALE', 'SOLD_OUT').required(),
});
router.post('/:categoryId/menus', ownerauth, async (req, res, next) => {
  try {
    const { error: categoryError } = categorySchema.validate(req.params);
    if (categoryError) {
      const error = new Error('데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    const { error: bodyError } = menuSchema.validate(req.body);
    if (bodyError) {
      const isPriceInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('price') && detail.type === 'number.min'
      );

      if (isPriceInvalid) {
        const error = new Error('메뉴 가격은 0보다 작을 수 없습니다.');
        error.status = 400;
        throw error;
      }
      const isStockInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('stock') && detail.type === 'number.min'
      );
      if (isStockInvalid) {
        const error = new Error('재고는 0보다 작을 수 없습니다.');
        error.status = 400;
        throw error;
      }
      const error = new Error('요청 데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    const categoryId = +req.params.categoryId;
    console.log(categoryId);
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: categoryId,
      },
    });
    if (!category) {
      const error = new Error('존재하지 않는 카테고리입니다.');
      error.status = 404;
      throw error;
    }
    const lastMenu = await prisma.menus.findFirst({
      where: {
        categoryId,
      },
      orderBy: {
        order: 'desc',
      },
    });
    const order = lastMenu ? lastMenu.order + 1 : 1;
    const status = req.body.stock === 0 ? 'SOLD_OUT' : 'FOR_SALE';
    await prisma.menus.create({
      data: {
        categoryId,
        name: req.body.name,
        description: req.body.description,
        image: req.body.image,
        price: req.body.price,
        stock: req.body.stock,
        status,
        order,
      },
    });
    return res.status(201).json({ message: '메뉴를 등록하였습니다.' });
  } catch (error) {
    next(error);
  }
});

router.get('/:categoryId/menus', async (req, res, next) => {
  try {
    const { error: categoryError } = categorySchema.validate(req.params);
    if (categoryError) {
      const error = new Error('데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    const categoryId = +req.params.categoryId;
    const category = await prisma.categories.findFirst({
      where: {
        categoryId,
        deletedAt: null,
      },
    });
    if (!category) {
      const error = new Error('존재하지 않는 카테고리입니다.');
      error.status = 404;
      throw error;
    }
    const menus = await prisma.menus.findMany({
      where: {
        categoryId,
        deletedAt: null,
      },
      orderBy: {
        order: 'asc',
      },
      select: {
        menuId: true,
        name: true,
        image: true,
        price: true,
        order: true,
        stock: true,
        status: true,
      },
    });
    const revisedmenus = menus.map((menu) => ({
      id: menu.menuId,
      ...menu,
    }));
    return res.status(200).json({ data: revisedmenus });
  } catch (error) {
    next(error);
  }
});
router.get('/:categoryId/menus/:menuId', async (req, res, next) => {
  try {
    const { error: paramsError } = categoryandmenuSchema.validate(req.params);
    if (paramsError) {
      const error = new Error('데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: +req.params.categoryId,
        deletedAt: null,
      },
    });
    if (!category) {
      const error = new Error('존재하지 않는 카테고리입니다.');
      error.status = 404;
      throw error;
    }
    const menu = await prisma.menus.findFirst({
      where: {
        menuId: +req.params.menuId,
        deletedAt: null,
      },
      select: {
        menuId: true,
        name: true,
        description: true,
        image: true,
        price: true,
        order: true,
        stock: true,
        status: true,
      },
    });
    if (!menu) {
      const error = new Error('존재하지 않는 메뉴입니다.');
      error.status = 404;
      throw error;
    }
    const revisedMenu = {
      id: menu.menuId,
      ...menu,
    };
    return res.status(200).json({ data: revisedMenu });
  } catch (error) {
    next(error);
  }
});

router.put('/:categoryId/menus/:menuId', ownerauth, async (req, res, next) => {
  try {
    const { error: paramsError } = categoryandmenuSchema.validate(req.params);
    if (paramsError) {
      const error = new Error('데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    const { error: bodyError } = menuStatusSchema.validate(req.body);
    if (bodyError) {
      const isPriceInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('price') && detail.type === 'number.min'
      );
      if (isPriceInvalid) {
        const error = new Error('메뉴 가격은 0보다 작을 수 없습니다.');
        error.status = 400;
        throw error;
      }
      const isStockInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('stock') && detail.type === 'number.min'
      );
      if (isStockInvalid) {
        const error = new Error('재고는 0보다 작을 수 없습니다.');
        error.status = 400;
        throw error;
      }
      const error = new Error('요청 데이터 형식이 올바르지 않습니다.');
      error.status = 400;
      throw error;
    }
    if (req.body.stock === 0 && req.body.status === 'FOR_SALE') {
      const error = new Error(
        '재고가 없는 메뉴는 판매 중으로 변경할 수 없습니다.'
      );
      error.status = 400;
      throw error;
    }
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: +req.params.categoryId,
        deletedAt: null,
      },
    });
    if (!category) {
      const error = new Error('존재하지 않는 카테고리입니다.');
      error.status = 404;
      throw error;
    }
    const menu = await prisma.menus.findFirst({
      where: {
        menuId: +req.params.menuId,
        deletedAt: null,
      },
    });
    if (!menu) {
      const error = new Error('존재하지 않는 메뉴입니다.');
      error.status = 404;
      throw error;
    }
    await prisma.menus.update({
      where: {
        menuId: +req.params.menuId,
      },
      data: {
        name: req.body.name,
        description: req.body.description,
        image: req.body.image,
        price: req.body.price,
        stock: req.body.stock,
        order: req.body.order,
        status: req.body.status,
      },
    });
    return res.status(200).json({ message: '메뉴를 수정하였습니다.' });
  } catch (error) {
    next(error);
  }
});

router.delete(
  '/:categoryId/menus/:menuId',
  ownerauth,
  async (req, res, next) => {
    try {
      const { error: paramsError } = categoryandmenuSchema.validate(req.params);
      if (paramsError) {
        const error = new Error('데이터 형식이 올바르지 않습니다.');
        error.status = 400;
        throw error;
      }
      const category = await prisma.categories.findFirst({
        where: {
          categoryId: +req.params.categoryId,
          deletedAt: null,
        },
      });
      if (!category) {
        const error = new Error('존재하지 않는 카테고리입니다.');
        error.status = 404;
        throw error;
      }
      const menu = await prisma.menus.findFirst({
        where: {
          menuId: +req.params.menuId,
          deletedAt: null,
        },
      });
      if (!menu) {
        const error = new Error('존재하지 않는 메뉴입니다.');
        error.status = 404;
        throw error;
      }
      await prisma.menus.update({
        where: {
          menuId: +req.params.menuId,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return res.status(200).json({ message: '메뉴를 삭제하였습니다.' });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
