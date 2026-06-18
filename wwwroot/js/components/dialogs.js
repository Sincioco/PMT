import { buttonContent } from "./buttons.js";
import {
  escapeAttr,
  escapeHtml
} from "../shared/text-and-links.js";

export function askYesNo(message, title) {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>${escapeHtml(title)}</h2>
      </div>
      <div class="dialog-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="no">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="yes">${buttonContent("&#10003;", "Continue")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = result => {
      modal.close();
      modal.remove();
      resolve(result);
    };

    modal.querySelector("[data-result='no']").addEventListener("click", () => finish(false));
    modal.querySelector("[data-result='yes']").addEventListener("click", () => finish(true));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(false);
    });

    modal.showModal();
  });
}

export function askFinishSprintOptions() {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <div class="dialog-head">
        <h2>Finish Sprint</h2>
      </div>
      <div class="dialog-body">
        <label class="inline-check">
          <input name="carryUnfinished" type="checkbox" checked>
          <span>Finish this Sprint and carry unfinished tasks forward?</span>
        </label>
        <label class="inline-check">
          <input name="carryTodos" type="checkbox">
          <span>Carry over the Todos in the next Sprint</span>
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
        <button type="button" class="primary text-icon-button" data-result="finish">${buttonContent("&#10003;", "Finish")}</button>
      </div>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(null));
    modal.querySelector("[data-result='finish']").addEventListener("click", () => finish({
      carryUnfinished: modal.querySelector("[name='carryUnfinished']").checked,
      carryTodos: modal.querySelector("[name='carryTodos']").checked
    }));
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });

    modal.showModal();
  });
}

export function askForText(label, title, placeholder = "") {
  return new Promise(resolve => {
    const modal = document.createElement("dialog");
    modal.className = "dialog mini-dialog";
    modal.innerHTML = `
      <form method="dialog">
        <div class="dialog-head">
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="dialog-body">
          <div class="field">
            <label>${escapeHtml(label)}</label>
            <input name="dialogText" value="${escapeAttr(placeholder)}">
          </div>
        </div>
        <div class="dialog-actions">
          <button type="button" class="secondary text-icon-button" data-result="cancel">${buttonContent("&#10005;", "Cancel")}</button>
          <button type="submit" class="primary text-icon-button">${buttonContent("&#10003;", "Apply")}</button>
        </div>
      </form>
    `;

    document.body.appendChild(modal);

    const finish = value => {
      modal.close();
      modal.remove();
      resolve(value);
    };

    modal.querySelector("[data-result='cancel']").addEventListener("click", () => finish(""));
    modal.querySelector("form").addEventListener("submit", event => {
      event.preventDefault();
      finish(modal.querySelector("[name='dialogText']").value);
    });
    modal.addEventListener("cancel", event => {
      event.preventDefault();
      finish("");
    });

    modal.showModal();
    setTimeout(() => modal.querySelector("[name='dialogText']").focus(), 0);
  });
}
