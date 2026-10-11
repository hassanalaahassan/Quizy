import { Injectable, inject } from '@angular/core';
import { DataSource } from '../data/data-source';
import { GameClass } from '../models/game-class.model';
import { Team, TeamMember } from '../models/team.model';
import { Question } from '../models/question.model';
import { Session, SessionQuestionState } from '../models/session.model';
import { generateId, now } from '../utils';

@Injectable({ providedIn: 'root' })
export class SeedService {
  private dataSource = inject(DataSource);

  seedDemoClassroom(): GameClass {
    const timestamp = now();
    const classId = generateId();

    // 1. Create Class: Grade 3A
    const demoClass: GameClass = {
      id: classId,
      name: 'Grade 3A',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.dataSource.saveClass(demoClass);

    // 2. Create 4 Teams
    const teamConfigs = [
      {
        name: 'Team Phoenix',
        score: 40,
        leader: 'Alex',
        members: ['Maya', 'Leo', 'Sofia'],
      },
      {
        name: 'Team Titans',
        score: 30,
        leader: 'Ethan',
        members: ['Emma', 'Noah', 'Zoe'],
      },
      {
        name: 'Team Alpha',
        score: 50,
        leader: 'Liam',
        members: ['Lucas', 'Ava', 'Mia'],
      },
      {
        name: 'Team Eagles',
        score: 20,
        leader: 'Daniel',
        members: ['Chloe', 'Oliver', 'Grace'],
      },
    ];

    for (const conf of teamConfigs) {
      const teamId = generateId();
      const team: Team = {
        id: teamId,
        classId,
        name: conf.name,
        totalScore: conf.score,
        createdAt: timestamp,
      };
      this.dataSource.saveTeam(team);

      // Members
      const members: TeamMember[] = [
        {
          id: generateId(),
          teamId,
          name: conf.leader,
          isLeader: true,
        },
        ...conf.members.map(m => ({
          id: generateId(),
          teamId,
          name: m,
          isLeader: false,
        })),
      ];
      this.dataSource.saveMembers(teamId, members);
      // Note: Green Cards are now assigned at session start, not at team creation
    }

    // 3. Create Sample Questions covering all 4 QuestionTypes
    const questionsData = [
      {
        questionType: 'mcq' as const,
        text: 'What is the closest planet to the Sun?',
        options: [{ text: 'Venus' }, { text: 'Mercury' }, { text: 'Mars' }, { text: 'Earth' }],
        correctOptionIndex: 1,
        points: 20,
        timerSeconds: 30,
        penaltyMode: 'none' as const,
        isGreenCardReward: false,
      },
      {
        questionType: 'true_false' as const,
        text: 'The Great Wall of China is visible from space with the naked eye.',
        options: [{ text: 'True' }, { text: 'False' }],
        correctOptionIndex: 1,
        points: 15,
        timerSeconds: 30,
        penaltyMode: 'deduct' as const,
        isGreenCardReward: false,
      },
      {
        questionType: 'short_answer' as const,
        text: 'What is the capital city of France?',
        options: [],
        correctOptionIndex: -1,
        correctAnswer: 'Paris',
        acceptedAnswers: ['Paris', 'paris'],
        points: 25,
        timerSeconds: 45,
        penaltyMode: 'none' as const,
        isGreenCardReward: false,
      },
      {
        questionType: 'complete' as const,
        text: 'Photosynthesis is the process by which plants convert light energy into _____ energy.',
        options: [],
        correctOptionIndex: -1,
        correctAnswer: 'chemical',
        acceptedAnswers: ['chemical', 'Chemical'],
        points: 30,
        timerSeconds: 60,
        penaltyMode: 'deduct' as const,
        isGreenCardReward: true, // Reward question!
      },
      {
        questionType: 'mcq' as const,
        text: 'Which gas do plants absorb from the atmosphere for photosynthesis?',
        options: [{ text: 'Oxygen' }, { text: 'Carbon Dioxide' }, { text: 'Nitrogen' }, { text: 'Hydrogen' }],
        correctOptionIndex: 1,
        points: 20,
        timerSeconds: 45,
        penaltyMode: 'none' as const,
        isGreenCardReward: false,
      },
    ];

    const questionIds: string[] = [];
    for (const q of questionsData) {
      const qId = generateId();
      questionIds.push(qId);
      const question: Question = {
        id: qId,
        classId,
        questionType: q.questionType,
        text: q.text,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        correctAnswer: q.correctAnswer,
        acceptedAnswers: q.acceptedAnswers,
        points: q.points,
        timerSeconds: q.timerSeconds,
        penaltyMode: q.penaltyMode,
        isGreenCardReward: q.isGreenCardReward,
        createdAt: timestamp,
      };
      this.dataSource.saveQuestion(question);
    }

    // 4. Create Session 1 (Paused at Question 2 to demonstrate resume capability)
    const sessionId = generateId();
    const session: Session = {
      id: sessionId,
      classId,
      name: 'Session 1: Science & Trivia Challenge',
      status: 'paused',
      questionIds,
      currentQuestionIndex: 1,
      startedAt: timestamp - 3600000,
      pausedAt: timestamp - 1800000,
      completedAt: null,
      createdAt: timestamp - 3600000,
    };
    this.dataSource.saveSession(session);

    // Session Question states
    const states: SessionQuestionState[] = questionIds.map((qId, idx) => ({
      id: generateId(),
      sessionId,
      questionId: qId,
      orderIndex: idx,
      status: idx === 0 ? 'answered' : idx === 1 ? 'active' : 'pending',
      timerRemainingSeconds: idx === 1 ? 30 : null,
    }));
    this.dataSource.saveSessionQuestionStates(sessionId, states);

    return demoClass;
  }
}
