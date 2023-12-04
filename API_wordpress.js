require("dotenv").config();
const { NoNewPostsError, ValidationError } = require("./errors.js");
const axios = require("axios");
const he = require("he");
const express = require("express");
const app = express();

const decodeHtmlEntities = (html) => {
  const decoded = he.decode(html);
  const match = decoded.match(/<p>(.*?)<\/p>/);
  return match ? match[1] : "";
};

const apiUrl = "https://fourthdimensioon.com/wp-json/wp/v2/posts";
const omnisendApiUrl = "https://api.omnisend.com/v3/products";
const omnisendApiKey = process.env.OMNISEND_API_KEY; // Reemplaza con tu clave de API de Omnisend

async function getImageUrl(mediaId) {
  const mediaUrl = `https://fourthdimensioon.com/wp-json/wp/v2/media/${mediaId}`;
  try {
    const response = await axios.get(mediaUrl);
    return response.data.source_url;
  } catch (error) {
    console.error("Error al obtener la URL de la imagen:", error);
    return "Sin imagen destacada";
  }
}

async function FechaAyer(date){
  const yesterday = new Date(date);
  console.log(yesterday)
  yesterday.setDate(yesterday.getDate() - 1);
  console.log(yesterday)
  return yesterday
}


async function getDataWordpress() {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const formattedDate = oneWeekAgo.toISOString();

    const params = {
      order: "desc",
      after: formattedDate,
    };

    const response = await axios.get(apiUrl, { params });
    if (!response.data.length) {
      throw new NoNewPostsError("No hay nuevos posts");
    }

    let omnisendDataArray = [];

    for (const post of response.data) {
      console.log(post.id);
      const postID = post.id.toString();
      const title = post.title.rendered;
      const description = decodeHtmlEntities(post.excerpt.rendered);
      const imageID = post.featured_media.toString();
      const imageUrl = await getImageUrl(post.featured_media);
      const entryUrl = post.link;
      const date =await FechaAyer(post.date);
      const omnisendData = {
        status: "inStock",
        title: title,
        description: description,
        productID: postID,
        productUrl: entryUrl,
        createdAt: date,
        currency: "USD",
        images: [
          {
            imageID: imageID,
            url: imageUrl,
            isDefault: true,
            variantIDs: [postID],
          },
        ],
        variants: [
          {
            productUrl: entryUrl,
            status: "inStock",
            variantID: postID,
            title: title,
            price: 0,
            imageID: imageID,
          },
        ],
      };

      console.log(omnisendData.images);
      omnisendDataArray.push(omnisendData);
    }

    return omnisendDataArray;
  } catch (error) {
    if (error instanceof NoNewPostsError) {
      console.error("Error de obtención de posts:", error.message);
      throw new Error(error.message);
    } else {
      console.error("Error general:", error.message);
      throw new Error("Error general");
    }
  }
}

async function sendToOmnisend(omnisendDataArray) {
  console.log(omnisendDataArray[0]);

  try {

    const newProducts = []
    for (const product of omnisendDataArray) {
      const response = await axios.post(omnisendApiUrl, product, {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          "X-API-Key": omnisendApiKey,
        },
      });
      console.log("Respuesta de Omnisend:", response.data.productID);
      newProducts.push(response.data.productID)
    }
    return newProducts
  } catch (error) {
    console.error("Error al enviar datos a Omnisend:", error.response.data);
    throw new Error(error.response.data.error);
  }
}

async function updateProducts() {
  try {
    const omnisendResponse = await sendToOmnisend(await getDataWordpress());
    console.log(omnisendResponse)
    return omnisendResponse;
  } catch (error) {
    throw error.message;
  }
}

app.get("/actualizar-productos", async (req, res) => {
  try {
    const response = await updateProducts();
    res.send(
      `los post han sido actualizados ${response}`
    );
  } catch (error) {
    res.status(404).send(`no se ha actualizado debido a que ${error}`);
  }
});

setInterval(updateProducts, 7 * 24 * 60 * 60 * 1000);

app.listen(process.env.PORT || 4000, () => {
  console.log(`Servidor en ejecución en http://localhost:${process.env.PORT}`);
});
