const core = require('@actions/core');
const github = require('@actions/github');
const request = require('request-promise-native');

try {
  const apiKey = process.env['TRELLO_API_KEY'];
  const apiToken = process.env['TRELLO_API_TOKEN'];
  const memberMap = JSON.parse(process.env['TRELLO_MEMBER_MAP']); // github username: trello username 
  const action = core.getInput('trello-action');

  switch (action) {
    case 'create_card_when_issue_opened':
      createCardWhenIssueOpen(apiKey, apiToken, memberMap);
      break;
    case 'change_card_when_issue_edited':
      changeCardWhenIssueEdited(apiKey, apiToken, memberMap);
      break;
    case 'move_card_when_pull_request_opened':
      moveCardWhenPullRequestOpen(apiKey, apiToken, memberMap);
      break;
    case 'move_card_when_pull_request_closed':
      moveCardWhenPullRequestClose(apiKey, apiToken, memberMap);
      break;

  }
} catch (error) {
  core.setFailed(error.message);
}

function createCardWhenIssueOpen(apiKey, apiToken, memberMap) {
  const bugLabels = process.env['BUG_LABELS'].split(',');
  // const listId = process.env['TRELLO_LIST_ID'];
  const issue = github.context.payload.issue
  const number = issue.number;
  var title = issue.title;
  const description = issue.body;
  const url = issue.html_url;
  const assignees = issue.assignees.map(assignee => assignee.login);
  const issueLabelNames = issue.labels.map(label => label.name);
  var isBug = false;
  issueLabelNames.forEach(function (issueLabelName) {
    bugLabels.forEach(function (bugLabel) {
      if (bugLabel == issueLabelName) {
        isBug = true;
      }
    });

  }
  );

  // get board name and ID, then listId of To Do list.
  var boardName = getBoardName(title);
  console.log(boardName);

  // remove boardName from the issue title
  title = title.replace(boardName, "").replace("[]", "");
  var name;
  var boardId;
  var listId;
  if (boardName) {
    // split boardName in multiple parts if " & " is present
    var names = boardName.split(" & ");
    console.log("Issue duplicates: " + names.length);
    getBoards(apiKey, apiToken).then(function (response) {
      for (var ii = 0; ii < names.length; ii++) {
        name = names[ii];
        boardId = getBoardId(response, name);
        if (boardId) {
          getLists(apiKey, apiToken, boardId).then(function (response) {
            if (isBug) {
              listId = getBugList(response);
            } else {
              listId = getToDoList(response);
            }
            if (listId) {
              getLabelsOfBoard(apiKey, apiToken, boardId).then(function (response) {
                const trelloLabels = response;
                const trelloLabelIds = [];
                issueLabelNames.forEach(function (issueLabelName) {
                  trelloLabels.forEach(function (trelloLabel) {
                    if (trelloLabel.name == issueLabelName) {
                      trelloLabelIds.push(trelloLabel.id);
                    }
                  });
                });

                getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
                  const members = response;
                  const memberIds = [];
                  assignees.forEach(function (assignee) {
                    members.forEach(function (member) {
                      if (member.username == memberMap[assignee]) {
                        memberIds.push(member.id)
                      }
                    });
                  });
                  const cardParams = {
                    number: number, title: title, description: description, url: url, memberIds: memberIds.join(), labelIds: trelloLabelIds.join()
                  }

                  createCard(apiKey, apiToken, listId, cardParams).then(function (response) {
                    // Remove cover from card 
                    const cardId = response.id;
                    removeCover(apiKey, apiToken, cardId);
                    console.dir(response);
                  });
                });
              });
            }
          });
        }
      }
    });
  }
}

function changeCardWhenIssueEdited(apiKey, apiToken, memberMap) {
  const bugLabels = process.env['BUG_LABELS'].split(',');
  const issue = github.context.payload.issue
  const number = issue.number;
  var title = issue.title;
  const description = issue.body;
  const url = issue.html_url;
  const assignees = issue.assignees.map(assignee => assignee.login);
  const issueLabelNames = issue.labels.map(label => label.name);
  var isBug = false;
  issueLabelNames.forEach(function (issueLabelName) {
    bugLabels.forEach(function (bugLabel) {
      if (bugLabel == issueLabelName) {
        isBug = true;
      }
    });

  }
  );

  // get board name and ID, then listId of To Do list.
  var boardName = getBoardName(title);
  console.log(boardName);

  // remove boardName from the issue title
  title = title.replace(boardName, "").replace("[]", "");
  var name;
  var boardId;
  var listId;
  if (boardName) {
    // split boardName in multiple parts if " & " is present
    var names = boardName.split(" & ");
    console.log("Issue duplicates: " + names.length);
    getBoards(apiKey, apiToken).then(function (response) {
      for (var ii = 0; ii < names.length; ii++) {
        name = names[ii];
        boardId = getBoardId(response, name);
        if (boardId) {
          getLists(apiKey, apiToken, boardId).then(function (response) {
            if (isBug) {
              listId = getBugList(response);
            } else {
              listId = getToDoList(response);
            }
            if (listId) {
              getLabelsOfBoard(apiKey, apiToken, boardId).then(function (response) {
                const trelloLabels = response;
                const trelloLabelIds = [];
                issueLabelNames.forEach(function (issueLabelName) {
                  trelloLabels.forEach(function (trelloLabel) {
                    if (trelloLabel.name == issueLabelName) {
                      trelloLabelIds.push(trelloLabel.id);
                    }
                  });
                });

                getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
                  const members = response;
                  const memberIds = [];
                  assignees.forEach(function (assignee) {
                    members.forEach(function (member) {
                      if (member.username == memberMap[assignee]) {
                        memberIds.push(member.id)
                      }
                    });
                  });
                  const cardParams = {
                    number: number, title: title, description: description, url: url, memberIds: memberIds.join(), labelIds: trelloLabelIds.join()
                  }

                  getCardsOfBoard(apiKey, apiToken, boardId).then(function (response) {
                    var targetTitle = title;
                    const fromTitle = github.context.payload.changes.title;
                    if (fromTitle != null) {
                      targetTitle = fromTitle;
                    }
                    const cards = response;
                    let cardId;
                    let existingMemberIds = [];
                    cards.some(function (card) {
                      if (card.name == `[#${number}] ${targetTitle}`) {
                        cardId = card.id;
                        existingMemberIds = card.idMembers;
                        return true;
                      }
                    });

                    if (cardId) {
                      updateCard(apiKey, apiToken, cardId, cardParams).then(function (response) {
                        // Remove cover from card 
                        const cardId = response.id;
                        removeCover(apiKey, apiToken, cardId);
                        console.dir(response);
                      });
                    } else {
                      core.setFailed('Card not found.');
                    }
                  });

                });
              });
            }
          });
        }
      }
    });
  }
}

function moveCardWhenPullRequestOpen(apiKey, apiToken, memberMap) {
  const departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
  const destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
  const pullRequest = github.context.payload.pull_request;
  const issue_number = pullRequest.body.match(/#[0-9]+/)[0].slice(1);
  const url = pullRequest.html_url;
  const reviewers = pullRequest.requested_reviewers.map(reviewer => reviewer.login);

  // get board name and ID, then listId of To Do list.
  console.log("pullRequest:" + pullRequest);
  console.log("pullRequest.issue.title:" + pullRequest.issue.title);
  var boardName = getBoardName(pullRequest.issue.title);
  console.log(boardName);
  var name;
  var boardId;
  if (boardName) {
    // split boardName in multiple parts if " & " is present
    var names = boardName.split(" & ");
    console.log("Issue duplicates: " + names.length);
    getBoards(apiKey, apiToken).then(function (response) {
      for (var ii = 0; ii < names.length; ii++) {
        name = names[ii];
        boardId = getBoardId(response, name);
        if (boardId) {
          getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
            const members = response;
            const additionalMemberIds = [];
            reviewers.forEach(function (reviewer) {
              members.forEach(function (member) {
                if (member.username == memberMap[reviewer]) {
                  additionalMemberIds.push(member.id);
                }
              });
            });

            getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
              const cards = response;
              let cardId;
              let existingMemberIds = [];
              cards.some(function (card) {
                const card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
                if (card_issue_number == issue_number) {
                  cardId = card.id;
                  existingMemberIds = card.idMembers;
                  return true;
                }
              });
              const cardParams = {
                destinationListId: destinationListId, memberIds: existingMemberIds.concat(additionalMemberIds).join()
              }

              if (cardId) {
                putCard(apiKey, apiToken, cardId, cardParams).then(function (response) {
                  addUrlSourceToCard(apiKey, apiToken, cardId, url);
                });
              } else {
                core.setFailed('Card not found.');
              }
            });
          });
        }
      }
    });
  }
}

function moveCardWhenPullRequestClose(apiKey, apiToken, memberMap) {
  const departureListId = process.env['TRELLO_DEPARTURE_LIST_ID'];
  const destinationListId = process.env['TRELLO_DESTINATION_LIST_ID'];
  const pullRequest = github.context.payload.pull_request
  const issue_number = pullRequest.body.match(/#[0-9]+/)[0].slice(1);
  const url = pullRequest.html_url;
  const reviewers = pullRequest.requested_reviewers.map(reviewer => reviewer.login);

  // get board name and ID, then listId of To Do list.
  var title = pullRequest.issue.title;
  var boardName = getBoardName(title);
  console.log(boardName);
  var name;
  var boardId;
  if (boardName) {
    // split boardName in multiple parts if " & " is present
    var names = boardName.split(" & ");
    console.log("Issue duplicates: " + names.length);
    getBoards(apiKey, apiToken).then(function (response) {
      for (var ii = 0; ii < names.length; ii++) {
        name = names[ii];
        boardId = getBoardId(response, name);
        if (boardId) {
          getMembersOfBoard(apiKey, apiToken, boardId).then(function (response) {
            const members = response;
            const additionalMemberIds = [];
            reviewers.forEach(function (reviewer) {
              members.forEach(function (member) {
                if (member.username == memberMap[reviewer]) {
                  additionalMemberIds.push(member.id);
                }
              });
            });
        
            getCardsOfList(apiKey, apiToken, departureListId).then(function (response) {
              const cards = response;
              let cardId;
              let existingMemberIds = [];
              cards.some(function (card) {
                const card_issue_number = card.name.match(/#[0-9]+/)[0].slice(1);
                if (card_issue_number == issue_number) {
                  cardId = card.id;
                  existingMemberIds = card.idMembers;
                  return true;
                }
              });
              const cardParams = {
                destinationListId: destinationListId, memberIds: existingMemberIds.concat(additionalMemberIds).join()
              }
        
              if (cardId) {
                putCard(apiKey, apiToken, cardId, cardParams);
              } else {
                core.setFailed('Card not found.');
              }
            });
          });
        }
      }
    });
  }
}

function getBoardName(title) {
  var board = title.match(/\[.+\]/g);
  if (board) {
    return board[0].replace("[", "").replace("]", "")
  }
  return null
}

function getBoardId(boards, boardName) {
  console.log("Boards length: " + boards.length);
  for (var ii = 0; ii < boards.length; ii++) {
    var board = boards[ii];
    if (board.name.toLowerCase() == boardName.toLowerCase()) {
      console.log("Board found! " + boardName);
      return board.id
    }
  }
  console.log("Board not found! " + boardName);
  return null
}

function getToDoList(lists) {
  console.log("Enter getToDo")
  // Get the list ID of the "To Do" list in the board
  for (var ii = 0; ii < lists.length; ii++) {
    var myList = lists[ii];
    if (myList.name.toLowerCase() == "todo") {
      return myList.id
    }
  }
  return null
}

function getBugList(lists) {
  console.log("Enter getBugList")
  for (var ii = 0; ii < lists.length; ii++) {
    var myList = lists[ii];
    if (myList.name.toLowerCase() == "bug") {
      return myList.id
    }
  }
  return null
}

function getBoards(apiKey, apiToken) {
  console.log("Enter getBoards")
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/members/me/boards?fields=name,id&key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
        console.log("Get Boards request success!");
        console.log("Boards found after request: " + JSON.parse(body).length)
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function getLists(apiKey, apiToken, boardId) {
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function getLabelsOfBoard(apiKey, apiToken, boardId) {
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/boards/${boardId}/labels?key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function getMembersOfBoard(apiKey, apiToken, boardId) {
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/boards/${boardId}/members?key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function getCardsOfList(apiKey, apiToken, listId) {
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/lists/${listId}/cards?key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function getCardsOfBoard(apiKey, apiToken, boardId) {
  return new Promise(function (resolve, reject) {
    request(`https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${apiToken}`)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}


function createCard(apiKey, apiToken, listId, params) {
  const options = {
    method: 'POST',
    url: 'https://api.trello.com/1/cards',
    form: {
      'idList': listId,
      'keepFromSource': 'all',
      'key': apiKey,
      'token': apiToken,
      'name': `[#${params.number}] ${params.title}`,
      'desc': params.description,
      'urlSource': params.url,
      'idMembers': params.memberIds,
      'idLabels': params.labelIds,
      'pos': 'bottom',
    },
    json: true
  }
  return new Promise(function (resolve, reject) {
    request(options)
      .then(function (body) {
        resolve(body);
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function updateCard(apiKey, apiToken, cardId, params) {
  const options = {
    method: 'PUT',
    url: `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`,
    form: {
      'name': `[#${params.number}] ${params.title}`,
      'desc': params.description,
      'urlSource': params.url,
      'idMembers': params.memberIds,
      'idLabels': params.labelIds,
    }
  }
  return new Promise(function (resolve, reject) {
    request(options)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function putCard(apiKey, apiToken, cardId, params) {
  const options = {
    method: 'PUT',
    url: `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`,
    form: {
      'idList': params.destinationListId,
      'idMembers': params.memberIds,
    }
  }
  return new Promise(function (resolve, reject) {
    request(options)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function removeCover(apiKey, apiToken, cardId) {
  const options = {
    method: 'PUT',
    url: `https://api.trello.com/1/cards/${cardId}?key=${apiKey}&token=${apiToken}`,
    form: {
      'idAttachmentCover': null
    }
  }
  return new Promise(function (resolve, reject) {
    request(options)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}

function addUrlSourceToCard(apiKey, apiToken, cardId, url) {
  const options = {
    method: 'POST',
    url: `https://api.trello.com/1/cards/${cardId}/attachments?key=${apiKey}&token=${apiToken}`,
    form: {
      url: url
    }
  }
  return new Promise(function (resolve, reject) {
    request(options)
      .then(function (body) {
        resolve(JSON.parse(body));
      })
      .catch(function (error) {
        reject(error);
      })
  });
}
