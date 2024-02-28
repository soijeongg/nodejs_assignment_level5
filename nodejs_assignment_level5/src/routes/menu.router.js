import express from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma/index.js';
import { ownerauth, customerauth } from '../middlewares/auth.middleware.js';

const router = express.Router();
// 검증을 위한  Joi schema 정의
const categorySchema = Joi.object({
  categoryId: Joi.number().integer().required(),
});
const caregoryandmenuSchema = Joi.object({
  categoryId: Joi.number().integer().required(),
  menuId: Joi.number().integer().required(),
});

const menuSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  image: Joi.string().required(),
  price: Joi.number().min(0).required(),
});
const menuStatusSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  price: Joi.number().min(0).required(),
  order: Joi.number().integer().required(),
  status: Joi.string().valid('FOR_SALE', 'SOLD_OUT').required(),
});
router.post('/:categoryId/menus', ownerauth, async (req, res, next) => {
  try {
    const { error: categoryError } = categorySchema.validate(req.params);
    if (categoryError) {
      return res
        .status(400)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    const { error: bodyError } = menuSchema.validate(req.body);
    if (bodyError) {
      const isPriceInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('price') && detail.type === 'number.min'
      );
      if (isPriceInvalid) {
        return res
          .status(400)
          .json({ message: '메뉴 가격은 0보다 작을 수 없습니다.' });
      }
      return res
        .status(400)
        .json({ message: '요청 데이터 형식이 올바르지 않습니다.' });
    }
    const categoryId = +req.params.categoryId;
    console.log(categoryId);
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: categoryId,
      },
    });
    if (!category) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다.' });
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

    await prisma.menus.create({
      data: {
        categoryId,
        name: req.body.name,
        description: req.body.description,
        image: req.body.image,
        price: req.body.price,
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
      return res
        .status(400)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    const categoryId = +req.params.categoryId;
    const category = await prisma.categories.findFirst({
      where: {
        categoryId,
      },
    });
    if (!category) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다.' });
    }
    const menus = await prisma.menus.findMany({
      where: {
        categoryId,
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
        status: true,
      },
    });
    const revisedmenus = menus.map((menu) => ({
      id: menu.menuId,
      ...menu,
      menuId: undefined,
    }));
    return res.status(200).json({ data: revisedmenus });
  } catch (error) {
    next(error);
  }
});
router.get('/:categoryId/menus/:menuId', async (req, res, next) => {
  try {
    const { error: paramsError } = caregoryandmenuSchema.validate(req.params);
    if (paramsError) {
      return res
        .status(400)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: +req.params.categoryId,
      },
    });
    if (!category) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다.' });
    }
    const { error: bodyError } = menuSchema.validate(req.body);
    const menu = await prisma.menus.findFirst({
      where: {
        menuId: +req.params.menuId,
      },
      select: {
        menuId: true,
        name: true,
        description: true,
        image: true,
        price: true,
        order: true,
        status: true,
      },
    });
    if (!menu) {
      return res.status(404).json({ message: '존재하지 않는 메뉴입니다.' });
    }
    const revisedMenu = {
      id: menu.menuId,
      ...menu,
      menuId: undefined,
    };
    return res.status(200).json({ data: revisedMenu });
  } catch (error) {
    next(error);
  }
});

router.put('/:categoryId/menus/:menuId', ownerauth, async (req, res, next) => {
  try {
    const { error: paramsError } = caregoryandmenuSchema.validate(req.params);
    if (paramsError) {
      return res
        .status(400)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    const { error: bodyError } = menuStatusSchema.validate(req.body);
    if (bodyError) {
      const isPriceInvalid = bodyError.details.some(
        (detail) =>
          detail.path.includes('price') && detail.type === 'number.min'
      );
      if (isPriceInvalid) {
        return res
          .status(400)
          .json({ message: '메뉴 가격은 0보다 작을 수 없습니다.' });
      }
      return res
        .status(400)
        .json({ message: '요청 데이터 형식이 올바르지 않습니다.' });
    }
    const category = await prisma.categories.findFirst({
      where: {
        categoryId: +req.params.categoryId,
      },
    });
    if (!category) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다.' });
    }
    const menu = await prisma.menus.findFirst({
      where: {
        menuId: +req.params.menuId,
      },
    });
    if (!menu) {
      return res.status(404).json({ message: '존재하지 않는 메뉴입니다.' });
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
      const { error: paramsError } = caregoryandmenuSchema.validate(req.params);
      if (paramsError) {
        return res
          .status(400)
          .json({ message: '데이터 형식이 올바르지 않습니다.' });
      }
      const category = await prisma.categories.findFirst({
        where: {
          categoryId: +req.params.categoryId,
        },
      });
      if (!category) {
        return res
          .status(404)
          .json({ message: '존재하지 않는 카테고리입니다.' });
      }
      const menu = await prisma.menus.findFirst({
        where: {
          menuId: +req.params.menuId,
        },
      });
      if (!menu) {
        return res.status(404).json({ message: '존재하지 않는 메뉴입니다.' });
      }
      await prisma.menus.delete({
        where: {
          menuId: +req.params.menuId,
        },
      });
      return res.status(200).json({ message: '메뉴를 삭제하였습니다.' });
    } catch (error) {
      next(error);
    }
  }
);
export default router;
