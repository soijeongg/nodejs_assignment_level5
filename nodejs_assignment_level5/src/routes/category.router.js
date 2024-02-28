import express from 'express';
import Joi from 'joi';
const router = express.Router();
import { prisma } from '../utils/prisma/index.js';
import { ownerauth, customerauth } from '../middlewares/auth.middleware.js';

//유효성 검사 위한 스키마 (수정시 사용함)
const schema = Joi.object({
  name: Joi.string().required(),
  order: Joi.number().integer().required(),
});
//유효성 검사위한 스키마 (등록시 사용)
const schemas = Joi.object({
  name: Joi.string().required(),
});
//카테고리 전체 조회
router.get('/', async (req, res, next) => {
  try {
    let category = await prisma.categories.findMany({
      select: {
        categoryId: true,
        name: true,
        order: true,
      },
      orderBy: {
        order: 'asc',
      },
    });
    return res.status(200).json({ data: category });
  } catch (error) {
    next(error);
  }
});

router.post('/', ownerauth, async (req, res, next) => {
  try {
    //없으면
    let { name } = req.body;
    const validationResult = schemas.validate({ name });
    if (validationResult.error) {
      return res
        .status(404)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    const lastCategory = await prisma.categories.findFirst({
      orderBy: { order: 'desc' },
    });
    const order = lastCategory ? lastCategory.order + 1 : 1;
    let category = await prisma.categories.create({
      data: {
        name,
        order,
      },
    });
    return res.status(200).json({ message: '카테고리를 등록하였습니다' });
  } catch (error) {
    next(error);
  }
});

router.put('/:categoryId', ownerauth, async (req, res, next) => {
  try {
    let { categoryId } = req.params;
    const { name, order } = req.body;
    const validationResult = schema.validate({ name, order });
    if (validationResult.error) {
      return res
        .status(404)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }
    let categoryfind = await prisma.categories.findFirst({
      where: { categoryId: +categoryId },
    });
    if (!categoryfind) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다' });
    }
    let updateOne = await prisma.categories.update({
      data: { name, order },
      where: {
        categoryId: +categoryId,
      },
    });
    return res.status(200).json({ message: '카테고리 정보를 수정하였습니다' });
  } catch (error) {
    next(error);
  }
});

router.delete('/:categoryId', ownerauth, async (req, res, next) => {
  try {
    let { categoryId } = req.params;
    let deleteOne = await prisma.categories.delete({
      where: { categoryId: +categoryId },
    });

    if (!deleteOne) {
      return res.status(404).json({ message: '존재하지 않는 카테고리입니다' });
    }
    return res.status(200).json({ message: '카테고리 정보를 삭제하였습니다.' });
  } catch (error) {
    next(error);
  }
});

export default router;
