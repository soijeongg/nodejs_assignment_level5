import express from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma/index.js';
import { ownerauth, customerauth } from '../middlewares/auth.middleware.js';

const router = express.Router();

//1, 2번 joi 필요시 작성
const orderSchema = Joi.object({
  menuId: Joi.number().required(),
  quantity: Joi.number().required(),
});
//3, 4 번 joi 필요시 작성
const statusSchemas = Joi.object({
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'CANCEL').required(),
});

const OrderSchemas = Joi.object({
  orderId: Joi.number().integer().required(),
});
// 1번 라우터 작성
// 1. 메뉴 주문 API
router.post('/', customerauth, async (req, res, next) => {
  try {
    // req.body가 배열인 경우
    if (Array.isArray(req.body)) {
      try {
        //transaction을 사용하여 여러개의 주문을 한번에 처리
        await prisma.$transaction(async (tx) => {
          //req.body의 각 주문에 대해서 실행
          for (const [index, order] of req.body.entries()) {
            //joi를 사용하여 유효성 검사
            const { error } = orderSchema.validate(order);
            if (error) {
              error.status = 400;
              throw new Error(
                `데이터 형식이 올바르지 않습니다. ${
                  index + 1
                }번째 데이터에서 오류가 발생했습니다.`
              );
            }
            const { menuId, quantity } = order;
            //menuId에 해당하는 메뉴가 존재하는지 확인
            const menu = await tx.menus.findUnique({
              where: { menuId: +menuId },
            });
            if (!menu) {
              const error = new Error(
                `존재하지 않는 메뉴입니다. ${
                  index + 1
                }번째 데이터에서 오류가 발생했습니다.`
              );
              error.status = 404;
              throw error;
            }
            //주문 테이블에 추가
            await tx.orders.create({
              data: {
                menuId: +menuId,
                quantity: +quantity,
                userId: req.user.userId,
                totalPrice: menu.price * quantity,
              },
            });
          }
        });
        return res.status(200).json({ message: '메뉴 주문에 성공하였습니다.' });
      } catch (error) {
        throw error;
      }
    } else {
      // req.body가 단일 객체인 경우
      const { error } = orderSchema.validate(req.body);
      if (error) {
        return res
          .status(400)
          .json({ message: '데이터 형식이 올바르지 않습니다.' });
      }
      const { menuId, quantity } = req.body;
      const menu = await prisma.menus.findUnique({
        where: { menuId: +menuId },
      });
      if (!menu) {
        return res.status(404).json({ message: '존재하지 않는 메뉴입니다.' });
      }
      await prisma.orders.create({
        data: {
          menuId: +menuId,
          quantity: +quantity,
          userId: req.user.userId,
          totalPrice: menu.price * quantity,
        },
      });
      return res.status(200).json({ message: '메뉴 주문에 성공하였습니다.' });
    }
  } catch (error) {
    next(error);
  }
});

// 2번 라우터 작성
// 2. 사용자 주문 내역 조회 API
router.get('/customer', customerauth, async (req, res, next) => {
  try {
    const orders = await prisma.orders.findMany({
      where: {
        userId: req.user.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        menu: {
          select: {
            name: true,
            price: true,
          },
        },
        quantity: true,
        status: true,
        createdAt: true,
        totalPrice: true,
      },
    });
    const revisedOrders = orders.map((order) => ({
      id: order.orderId,
      ...order,
    }));
    return res.status(200).json({ data: revisedOrders });
  } catch (error) {
    next(error);
  }
});
// 3번 라우터 작성
//사장님 주문내역 조회 relation테이블의 정보를 가져와 보여주는 include 사용
router.get('/owner', ownerauth, async (req, res, next) => {
  try {
    let findOrder = await prisma.Orders.findMany({
      select: {
        orderId: true,

        user: {
          select: {
            nickname: true,
          },
        },
        menu: {
          select: {
            name: true,
            price: true,
          },
        },
        quantity: true,
        status: true,
        createdAt: true,
        totalPrice: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.status(200).json({ data: findOrder });
  } catch (error) {
    next(error);
  }
});

// 4번 라우터 작성
//주문 상태 변경 주문 아이디 주문 상태를 받고 토큰 사장일때만
router.put('/:orderId/status', ownerauth, async (req, res, next) => {
  try {
    let { orderId } = req.params;
    let { status } = req.body;
    const validationResult = OrderSchemas.validate({ orderId });
    if (validationResult.error) {
      return res
        .status(404)
        .json({ message: '데이터 형식이 올바르지 않습니다.' });
    }

    const validation = statusSchemas.validate({ status });
    if (validation.error) {
      return res
        .status(404)
        .json({ message: '데이터 형식이 올바르지 않습니다' });
    }

    let findOrder = await prisma.orders.findFirst({
      where: { orderId: +orderId },
    });
    if (!findOrder) {
      return res.status(404).json({ message: '존재하지 않는 주문내역입니다.' });
    }
    let updateOne = await prisma.orders.update({
      data: { status },
      where: { orderId: +orderId },
    });
    res.status(200).json({ data: '주문 내역을 수정하였습니다.' });
  } catch (error) {
    next(error);
  }
});

export default router;
