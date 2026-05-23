"""
大脑决策引擎 - 根据性格动态决策
"""
import json
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class ActionScore:
    """动作评分结果"""
    action_id: str
    base_score: float
    personality_bonus: float
    personality_penalty: float
    state_modifier: float
    target_bonus: float
    final_score: float
    can_execute: bool
    reason: str


class BrainDecisionEngine:
    """大脑决策引擎"""

    def __init__(self, brain_library_path: str):
        """初始化决策引擎"""
        with open(brain_library_path, 'r', encoding='utf-8') as f:
            self.brain_lib = json.load(f)

        self.action_requirements = self.brain_lib.get("动作性格要求", {})

    def can_trigger_action(self, npc_personality: Dict[str, int], action_id: str) -> tuple[bool, str]:
        """
        检查NPC是否可以触发某个动作

        Returns:
            (是否可以触发, 原因)
        """
        if action_id not in self.action_requirements:
            return True, "动作无特殊要求"

        action_config = self.action_requirements[action_id]
        requirements = action_config.get("必要条件", {})

        # 检查必要条件
        for trait, condition in requirements.items():
            npc_value = npc_personality.get(trait, 5)

            if condition.startswith(">="):
                threshold = int(condition[2:])
                if npc_value < threshold:
                    return False, f"{trait}需要>={threshold},实际为{npc_value}"
            elif condition.startswith("<="):
                threshold = int(condition[2:])
                if npc_value > threshold:
                    return False, f"{trait}需要<={threshold},实际为{npc_value}"

        return True, "满足所有必要条件"

    def calculate_action_score(
        self,
        npc_personality: Dict[str, int],
        action_id: str,
        current_state: Dict[str, Any],
        target_info: Optional[Dict] = None
    ) -> ActionScore:
        """
        计算动作的效用分数
        """
        # 基础分
        base_score = 50.0

        # 检查是否可以执行
        can_execute, reason = self.can_trigger_action(npc_personality, action_id)

        if not can_execute:
            return ActionScore(
                action_id=action_id,
                base_score=base_score,
                personality_bonus=0,
                personality_penalty=0,
                state_modifier=0,
                target_bonus=0,
                final_score=0,
                can_execute=False,
                reason=reason
            )

        action_config = self.action_requirements.get(action_id, {})
        bonus = 0.0
        penalty = 0.0

        # 计算加分项
        for trait, condition in action_config.get("加分项", {}).items():
            npc_value = npc_personality.get(trait, 5)
            if ">=" in condition:
                threshold = int(condition.split(">=")[1].split()[0])
                if npc_value >= threshold:
                    # 提取加分值
                    if "加" in condition:
                        add_value = int(condition.split("加")[1].replace("分", ""))
                        bonus += add_value

        # 计算减分项
        for trait, condition in action_config.get("减分项", {}).items():
            npc_value = npc_personality.get(trait, 5)
            if ">=" in condition:
                threshold = int(condition.split(">=")[1].split()[0])
                if npc_value >= threshold:
                    # 提取减分值
                    if "减" in condition:
                        sub_value = int(condition.split("减")[1].replace("分", ""))
                        penalty += sub_value

        # 状态修正
        state_modifier = 0.0
        hunger = current_state.get("饥饿", 7)
        fatigue = current_state.get("疲劳", 3)

        if hunger < 4:
            state_modifier -= 20  # 太饿了，不想动
        if fatigue > 7:
            state_modifier -= 15  # 太累了

        # 目标加成
        target_bonus = 0.0
        if target_info:
            if "外貌" in target_info:
                target_bonus += target_info["外貌"] * 2  # 外貌越高越有动力

        # 最终分数
        final_score = base_score + bonus - penalty + state_modifier + target_bonus

        return ActionScore(
            action_id=action_id,
            base_score=base_score,
            personality_bonus=bonus,
            personality_penalty=penalty,
            state_modifier=state_modifier,
            target_bonus=target_bonus,
            final_score=max(0, final_score),
            can_execute=True,
            reason=reason
        )

    def decide_action(
        self,
        npc_data: Dict[str, Any],
        available_actions: List[str],
        environment: Dict[str, Any]
    ) -> Optional[ActionScore]:
        """
        决策：从可用动作中选择最优动作
        """
        personality = npc_data.get("性格", {})
        current_state = npc_data.get("生理状态", {})

        # 获取周围目标信息
        targets = environment.get("可见目标", [])
        target_info = targets[0] if targets else None

        # 为每个动作打分
        scored_actions: List[ActionScore] = []
        for action_id in available_actions:
            score = self.calculate_action_score(
                personality,
                action_id,
                current_state,
                target_info
            )
            scored_actions.append(score)

        # 过滤掉不能执行的动作
        valid_actions = [s for s in scored_actions if s.can_execute]

        if not valid_actions:
            return None

        # 选择分数最高的
        best_action = max(valid_actions, key=lambda x: x.final_score)

        return best_action

    def get_available_actions(self, npc_data: Dict) -> List[str]:
        """
        根据NPC当前状态获取可用动作列表
        """
        actions = []
        current_state = npc_data.get("当前状态", "空闲")

        # 基础动作
        if current_state == "空闲":
            actions = [
                "action_追求",
                "action_搭讪",
                "action_送礼",
                "action_工作",
                "action_分享信息"
            ]
        elif current_state == "看店":
            actions = ["action_交易"]
        elif current_state == "移动":
            actions = ["action_移动"]

        return actions


# 使用示例
if __name__ == "__main__":
    # 初始化引擎
    engine = BrainDecisionEngine("../../data/libraries/Brains_Library.json")

    # 加载云飞数据
    with open("../../NPC/云飞/个人信息.json", 'r', encoding='utf-8') as f:
        yunfei = json.load(f)

    # 获取可用动作
    available = engine.get_available_actions(yunfei)
    print(f"云飞可用动作: {available}")

    # 决策环境
    environment = {
        "可见目标": [{"外貌": 9, "名称": "齐琳琳"}],
        "时间": "2026-06-01 10:00:00"
    }

    # 决策
    decision = engine.decide_action(yunfei, available, environment)

    if decision:
        print(f"\n决策结果:")
        print(f"  动作: {decision.action_id}")
        print(f"  基础分: {decision.base_score}")
        print(f"  性格加成: +{decision.personality_bonus}")
        print(f"  性格减分: -{decision.personality_penalty}")
        print(f"  状态修正: {decision.state_modifier}")
        print(f"  目标加成: +{decision.target_bonus}")
        print(f"  最终得分: {decision.final_score}")
        print(f"  原因: {decision.reason}")
    else:
        print("没有可执行的动作")
